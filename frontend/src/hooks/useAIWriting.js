import { useState, useEffect, useCallback, useRef } from 'react';
import { aiService } from '../services/aiService';

const COLLAB_AGENT_FLOW = [
  { id: 'planner', name: '剧情规划', status: '规划剧情', tone: 'indigo' },
  { id: 'consistency', name: '设定校对', status: '检查设定', tone: 'slate' },
  { id: 'prose', name: '文风润色', status: '生成文本', tone: 'rose' }
];

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
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);
  const [showGenerationActions, setShowGenerationActions] = useState(false);
  const [currentAiActionLabel, setCurrentAiActionLabel] = useState('对话建议');
  const resetAssistantThreadRef = useRef(null);

  useEffect(() => {
    if (aiChatState || setAiChatState) {
      console.warn('[useAIWriting] chat 持久化暂时禁用，待 useExternalStoreRuntime 接入');
    }
  }, [aiChatState, setAiChatState]);

  const isLoading = assistantRunning || quickActionLoading;

  // 生成时轮转 Agent 激活态（纯 UI 模拟）
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
    setCurrentAiActionLabel('对话建议');
  }, []);

  // assistant-ui 自带 viewport 锚定；保留占位方法给后续外部调用兼容。
  const scrollToBottom = useCallback(() => {}, []);

  const handleAIAction = async (action) => {
    if (!currentChapter || isLoading) return;

    if (modelConfigs.length === 0) {
      addNotification?.({
        message: '未找到可用的AI模型配置。请先在设置中添加您的AI服务配置。',
        type: 'warning',
        duration: 3000
      });
      return;
    }

    const actionLabelMap = {
      outline: '章节大纲',
      suggestions: '剧情建议',
      optimize: '文本润色',
      ideas: '创意发散'
    };

    setCurrentAiActionLabel(actionLabelMap[action] || 'AI处理');
    setShowGenerationActions(false);
    setQuickActionLoading(true);

    try {
      let response;
      switch (action) {
        case 'outline':
          response = await aiService.generateChapterOutline(projectId, {
            chapter_number: currentChapter.chapter_number,
            user_requirements: `章节标题: ${currentChapter.title}\n当前内容: ${content}`
          });
          break;
        case 'suggestions':
          response = await aiService.getPlotSuggestions(projectId, {
            content
          });
          break;
        case 'optimize':
          response = await aiService.optimizeContent(projectId, content);
          if (response.optimized_content) {
            onContentChange(response.optimized_content);
          }
          break;
        case 'ideas':
          response = await aiService.generateCreativeIdeas(projectId, '请为当前章节提供一些创意建议');
          break;
        default:
          return;
      }

      addNotification?.({
        message: `${actionLabelMap[action] || 'AI处理'}已完成`,
        type: 'success',
        duration: 2200
      });
      setShowGenerationActions(true);
    } catch (error) {
      addNotification?.({
        message: `${actionLabelMap[action] || action} 操作失败: ${error.message}`,
        type: 'error',
        duration: 3000
      });
    } finally {
      setQuickActionLoading(false);
    }
  };

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

  const handleAcceptGeneratedResult = () => {
    // TODO: assistant-ui 持久化接入后，从 thread state 读取最近 assistant 消息并采纳到正文。
    setShowGenerationActions(false);
  };

  const handleRewriteGeneratedResult = () => {
    // TODO: assistant-ui 持久化接入后，将 rewrite 指令写入 Composer 或基于最近 assistant 消息重新生成。
    setShowGenerationActions(false);
    addNotification?.({
      message: '重写入口已保留，待聊天持久化方案接入后启用。',
      type: 'info',
      duration: 2400
    });
  };

  return {
    isLoading,
    showGenerationActions,
    currentAiActionLabel,
    handleNewChat,
    handleAIAction,
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
    setSelectedPromptTemplate
  };
};

export default useAIWriting;
