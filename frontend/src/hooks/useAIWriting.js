import { useState, useEffect, useCallback, useRef } from 'react';
import { aiService } from '../services/aiService';

const COLLAB_AGENT_FLOW = [
  { id: 'planner', name: '剧情规划', status: '规划剧情', tone: 'indigo' },
  { id: 'consistency', name: '设定校对', status: '检查设定', tone: 'slate' },
  { id: 'prose', name: '文风润色', status: '生成文本', tone: 'rose' }
];

const ACTION_LABELS = {
  outline: '章节大纲',
  suggestions: '剧情建议',
  optimize: '文本润色',
  ideas: '创意发散',
  ask: '选区提问',
  expand: '扩写选区'
};

const getResponseText = (response, fields) => {
  for (const field of fields) {
    const value = response?.[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
  }
  return '';
};

const appendWithSpacing = (base, addition) => {
  if (!base?.trim()) return addition;
  const separator = base.endsWith('\n') ? '\n' : '\n\n';
  return `${base}${separator}${addition}`;
};

const insertAfterRange = (base, range, addition) => {
  if (!range || range.end < 0 || range.end > base.length) {
    return appendWithSpacing(base, addition);
  }
  const before = base.slice(0, range.end);
  const after = base.slice(range.end);
  const prefix = before.endsWith('\n') ? '\n' : '\n\n';
  const suffix = after.startsWith('\n') || !after ? '' : '\n\n';
  return `${before}${prefix}${addition}${suffix}${after}`;
};

const replaceRange = (base, range, replacement) => {
  if (!range || range.start < 0 || range.end > base.length || range.start > range.end) {
    return appendWithSpacing(base, replacement);
  }
  return `${base.slice(0, range.start)}${replacement}${base.slice(range.end)}`;
};

const createProposalId = () => `proposal-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const useAIWriting = ({
  projectId,
  currentChapter,
  content,
  onContentChange,
  modelConfigs,
  selectedModelConfig,
  handleModelConfigChange,
  aiChatState,
  setAiChatState,
  selectedPromptTemplate,
  setSelectedPromptTemplate,
  promptTemplates,
  addNotification,
  isLoadingTemplates
}) => {
  const [assistantRunning, setAssistantRunning] = useState(false);
  const [quickActionLoading, setQuickActionLoading] = useState(false);
  const [selectionActionLoading, setSelectionActionLoading] = useState(null);
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);
  const [showGenerationActions, setShowGenerationActions] = useState(false);
  const [currentAiActionLabel, setCurrentAiActionLabel] = useState('对话建议');
  const [editorProposal, setEditorProposal] = useState(null);
  const resetAssistantThreadRef = useRef(null);

  // chat 持久化已通过 useExternalStoreRuntime 接通：messages 由
  // useWritingPersistentState 按 projectId 维度持久化（项目级共享，跨章节延续）。
  // 这里直接把 aiChatState.messages / setAiChatState 透传给 AIChatPanel。
  const chatMessages = aiChatState?.messages || [];
  const setChatMessages = useCallback((value) => {
    if (!setAiChatState) return;
    if (typeof value === 'function') {
      setAiChatState((prev) => ({
        ...(prev || {}),
        messages: value(prev?.messages || []),
      }));
    } else {
      setAiChatState((prev) => ({
        ...(prev || {}),
        messages: value,
      }));
    }
  }, [setAiChatState]);

  useEffect(() => {
    setEditorProposal(null);
    setShowGenerationActions(false);
  }, [currentChapter?.id]);

  const isLoading = assistantRunning || quickActionLoading || Boolean(selectionActionLoading);

  useEffect(() => {
    if (!isLoading) return;

    const timer = setInterval(() => {
      setActiveAgentIndex(prev => (prev + 1) % COLLAB_AGENT_FLOW.length);
    }, 1400);

    return () => clearInterval(timer);
  }, [isLoading]);

  const handleNewChat = useCallback(() => {
    resetAssistantThreadRef.current?.();
    setShowGenerationActions(false);
    setEditorProposal(null);
    setCurrentAiActionLabel('对话建议');
  }, []);

  const scrollToBottom = useCallback(() => {}, []);

  const createEditorProposal = useCallback((proposal) => {
    const normalized = {
      id: createProposalId(),
      title: 'AI 提案',
      sourceLabel: 'AI 生成',
      action: 'proposal',
      proposedText: '',
      originalText: '',
      range: null,
      applyMode: 'append',
      canReplaceAll: true,
      isReference: false,
      createdAt: Date.now(),
      ...proposal
    };

    setEditorProposal(normalized);
    setShowGenerationActions(true);
  }, []);

  const ensureCanUseAI = useCallback((actionLabel) => {
    if (!currentChapter || isLoading) return false;

    if (modelConfigs.length === 0) {
      addNotification?.({
        message: '未找到可用的 AI 模型配置。请先在设置中添加 AI 服务配置。',
        type: 'warning',
        duration: 3000
      });
      return false;
    }

    setCurrentAiActionLabel(actionLabel);
    return true;
  }, [addNotification, currentChapter, isLoading, modelConfigs.length]);

  const handleAIAction = async (action) => {
    const actionLabel = ACTION_LABELS[action] || 'AI 处理';
    if (!ensureCanUseAI(actionLabel)) return;

    setShowGenerationActions(false);
    setQuickActionLoading(true);

    try {
      let response;
      let proposedText = '';
      let proposalMeta = {};

      switch (action) {
        case 'outline':
          response = await aiService.generateChapterOutline(projectId, {
            chapter_number: currentChapter.chapter_number,
            user_requirements: `章节标题: ${currentChapter.title}\n当前内容: ${content}`
          });
          proposedText = getResponseText(response, ['outline', 'content', 'response']);
          proposalMeta = {
            title: '章节大纲提案',
            sourceLabel: '大纲生成',
            applyMode: content?.trim() ? 'append' : 'replace-all',
            canReplaceAll: true
          };
          break;
        case 'suggestions':
          response = await aiService.getPlotSuggestions(projectId, {
            content
          });
          proposedText = getResponseText(response, ['suggestions', 'content', 'response']);
          proposalMeta = {
            title: '剧情建议提案',
            sourceLabel: '剧情建议',
            applyMode: 'append',
            canReplaceAll: false,
            isReference: true
          };
          break;
        case 'optimize':
          response = await aiService.optimizeContent(projectId, content);
          proposedText = getResponseText(response, ['optimized_content', 'content', 'response']);
          proposalMeta = {
            title: '全文润色提案',
            sourceLabel: '文本润色',
            originalText: content,
            applyMode: content?.trim() ? 'replace-all' : 'append',
            canReplaceAll: true
          };
          break;
        case 'ideas':
          response = await aiService.generateCreativeIdeas(projectId, '请为当前章节提供一些创意建议');
          proposedText = getResponseText(response, ['ideas', 'content', 'response']);
          proposalMeta = {
            title: '创意发散提案',
            sourceLabel: '创意发散',
            applyMode: 'append',
            canReplaceAll: false,
            isReference: true
          };
          break;
        default:
          return;
      }

      if (!proposedText) {
        throw new Error('AI 没有返回可用内容');
      }

      createEditorProposal({
        action,
        proposedText,
        ...proposalMeta
      });

      addNotification?.({
        message: `${actionLabel}已生成，等待你采纳`,
        type: 'success',
        duration: 2200
      });
    } catch (error) {
      addNotification?.({
        message: `${actionLabel}操作失败: ${error.message}`,
        type: 'error',
        duration: 3000
      });
    } finally {
      setQuickActionLoading(false);
    }
  };

  const handleSelectionAction = useCallback(async (action, selection) => {
    const selectedText = selection?.text?.trim();
    const actionLabel = ACTION_LABELS[action] || '选区操作';

    if (!selectedText) return;
    if (!ensureCanUseAI(actionLabel)) return;

    setSelectionActionLoading(action);

    try {
      let response;
      let proposedText = '';
      let proposalMeta = {
        action,
        originalText: selectedText,
        range: {
          start: selection.start,
          end: selection.end
        },
        sourceLabel: actionLabel
      };

      switch (action) {
        case 'ask':
          response = await aiService.chatWithAI(
            projectId,
            `请分析这段小说正文，指出它的情绪、节奏、信息清晰度和可改进点：\n\n${selectedText}`,
            [],
            selectedPromptTemplate?.id
          );
          proposedText = getResponseText(response, ['response', 'content']);
          proposalMeta = {
            ...proposalMeta,
            title: '选区提问结果',
            applyMode: 'append',
            canReplaceAll: false,
            isReference: true
          };
          break;
        case 'optimize':
          response = await aiService.optimizeContent(projectId, selectedText, 'polish');
          proposedText = getResponseText(response, ['optimized_content', 'content', 'response']);
          proposalMeta = {
            ...proposalMeta,
            title: '选区润色提案',
            applyMode: 'replace-selection',
            canReplaceAll: false
          };
          break;
        case 'expand':
          response = await aiService.chatWithAI(
            projectId,
            `请把下面这段小说正文扩写成更有画面感的一段，保持视角、语气和事实不变，只返回可直接放入正文的文本：\n\n${selectedText}`,
            [],
            selectedPromptTemplate?.id
          );
          proposedText = getResponseText(response, ['response', 'content']);
          proposalMeta = {
            ...proposalMeta,
            title: '选区扩写提案',
            applyMode: 'replace-selection',
            canReplaceAll: false
          };
          break;
        case 'ideas':
          response = await aiService.generateCreativeIdeas(
            projectId,
            `请围绕这段小说正文发散后续剧情、冲突升级或人物选择：\n\n${selectedText}`,
            'plot'
          );
          proposedText = getResponseText(response, ['ideas', 'content', 'response']);
          proposalMeta = {
            ...proposalMeta,
            title: '选区剧情发散',
            applyMode: 'insert-after-selection',
            canReplaceAll: false,
            isReference: true
          };
          break;
        default:
          return;
      }

      if (!proposedText) {
        throw new Error('AI 没有返回可用内容');
      }

      createEditorProposal({
        ...proposalMeta,
        proposedText
      });

      addNotification?.({
        message: `${actionLabel}已生成，等待你采纳`,
        type: 'success',
        duration: 2200
      });
    } catch (error) {
      addNotification?.({
        message: `${actionLabel}失败: ${error.message}`,
        type: 'error',
        duration: 3000
      });
    } finally {
      setSelectionActionLoading(null);
    }
  }, [addNotification, createEditorProposal, ensureCanUseAI, projectId, selectedPromptTemplate?.id]);

  const agentStatuses = COLLAB_AGENT_FLOW.map((agent, index) => {
    if (!isLoading) {
      return {
        ...agent,
        status: index === 0 ? '待命' : '空闲',
        active: false
      };
    }

    const statusByIndex = ['正在执行', '准备中', '等待中'];
    const distance = (index - activeAgentIndex + COLLAB_AGENT_FLOW.length) % COLLAB_AGENT_FLOW.length;

    return {
      ...agent,
      status: index === activeAgentIndex ? `${currentAiActionLabel}` : statusByIndex[distance] || '等待中',
      active: index === activeAgentIndex
    };
  });

  const handleApplyEditorProposal = useCallback((mode) => {
    if (!editorProposal) return;

    const proposedText = editorProposal.proposedText || '';
    const applyMode = mode || editorProposal.applyMode || 'append';
    let nextContent;

    switch (applyMode) {
      case 'replace-selection':
        nextContent = replaceRange(content || '', editorProposal.range, proposedText);
        break;
      case 'insert-after-selection':
        nextContent = insertAfterRange(content || '', editorProposal.range, proposedText);
        break;
      case 'replace-all':
        nextContent = proposedText;
        break;
      case 'append':
      default:
        nextContent = appendWithSpacing(content || '', proposedText);
        break;
    }

    onContentChange(nextContent);
    setEditorProposal(null);
    setShowGenerationActions(false);
    addNotification?.({
      message: 'AI 提案已写入编辑区',
      type: 'success',
      duration: 2000
    });
  }, [addNotification, content, editorProposal, onContentChange]);

  const handleDismissEditorProposal = useCallback(() => {
    setEditorProposal(null);
    setShowGenerationActions(false);
  }, []);

  const handleCopyEditorProposal = useCallback(async () => {
    if (!editorProposal?.proposedText) return;

    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('当前浏览器不支持剪贴板写入');
      }
      await navigator.clipboard.writeText(editorProposal.proposedText);
      addNotification?.({
        message: 'AI 提案已复制',
        type: 'success',
        duration: 1800
      });
    } catch (error) {
      addNotification?.({
        message: `复制失败: ${error.message}`,
        type: 'warning',
        duration: 2200
      });
    }
  }, [addNotification, editorProposal]);

  const handleAcceptGeneratedResult = useCallback(() => {
    handleApplyEditorProposal(editorProposal?.applyMode);
  }, [editorProposal?.applyMode, handleApplyEditorProposal]);

  const handleRewriteGeneratedResult = useCallback(() => {
    setEditorProposal(null);
    setShowGenerationActions(false);
    addNotification?.({
      message: '已放弃当前 AI 提案，可重新生成',
      type: 'info',
      duration: 2200
    });
  }, [addNotification]);

  return {
    isLoading,
    showGenerationActions,
    currentAiActionLabel,
    editorProposal,
    selectionActionLoading,
    handleNewChat,
    handleAIAction,
    handleSelectionAction,
    handleApplyEditorProposal,
    handleDismissEditorProposal,
    handleCopyEditorProposal,
    handleAcceptGeneratedResult,
    handleRewriteGeneratedResult,
    onAssistantRunningChange: setAssistantRunning,
    onRegisterNewChat: (resetHandler) => {
      resetAssistantThreadRef.current = resetHandler;
    },
    scrollToBottom,
    agentStatuses,
    handleModelConfigChange,
    selectedModelConfig,
    selectedPromptTemplate,
    promptTemplates,
    modelConfigs,
    isLoadingTemplates,
    setSelectedPromptTemplate,
    // 受控 chat messages（项目级持久化，由 useExternalStoreRuntime 消费）
    messages: chatMessages,
    setMessages: setChatMessages,
  };
};

export default useAIWriting;
