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
  // 从持久化状态恢复聊天记录，如果没有则使用默认消息
  const [messages, setMessages] = useState(() => {
    if (aiChatState?.messages && aiChatState.messages.length > 0) {
      return aiChatState.messages;
    }
    return [
      { id: 1, role: 'assistant', content: '你好！我是你的AI写作助手。我可以帮助你进行创意构思、内容优化、情节建议等。有什么需要帮助的吗？' }
    ];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);
  const [showGenerationActions, setShowGenerationActions] = useState(false);
  const [currentAiActionLabel, setCurrentAiActionLabel] = useState('对话建议');
  const messagesContainerRef = useRef(null);
  const chatInputRef = useRef(null);
  const loadingStateRef = useRef(false);

  // 用于防止循环更新的标记
  const isUpdatingFromState = useRef(false);
  const isUpdatingToState = useRef(false);

  // 当章节变化或aiChatState变化时，更新聊天记录
  useEffect(() => {
    if (currentChapter?.id && aiChatState?.messages && !isUpdatingFromState.current) {
      isUpdatingFromState.current = true;
      // 如果有持久化的消息记录，使用它
      if (aiChatState.messages.length > 0) {
        setMessages(aiChatState.messages);
      } else {
        // 如果没有，重置为默认消息
        const defaultMessages = [
          { id: 1, role: 'assistant', content: '你好！我是你的AI写作助手。我可以帮助你进行创意构思、内容优化、情节建议等。有什么需要帮助的吗？' }
        ];
        setMessages(defaultMessages);
        // 持久化默认消息
        if (setAiChatState && !isUpdatingToState.current) {
          isUpdatingToState.current = true;
          setAiChatState({ messages: defaultMessages });
          setTimeout(() => { isUpdatingToState.current = false; }, 0);
        }
      }
      setTimeout(() => { isUpdatingFromState.current = false; }, 0);
    }
  }, [currentChapter?.id, aiChatState, setAiChatState]);

  // 消息变化时持久化到存储（只在非初始化更新时）
  useEffect(() => {
    if (currentChapter?.id && messages.length > 1 && setAiChatState && !isUpdatingFromState.current && !isUpdatingToState.current) {
      isUpdatingToState.current = true;
      setAiChatState({ messages });
      setTimeout(() => { isUpdatingToState.current = false; }, 0);
    }
  }, [messages, currentChapter?.id, setAiChatState]);

  // 生成时轮转 Agent 激活态（纯 UI 模拟）
  useEffect(() => {
    if (!isLoading) return;

    const timer = setInterval(() => {
      setActiveAgentIndex(prev => (prev + 1) % COLLAB_AGENT_FLOW.length);
    }, 1400);

    return () => clearInterval(timer);
  }, [isLoading]);

  // 控制生成完成后的“采纳/重写”操作栏显示
  useEffect(() => {
    if (loadingStateRef.current && !isLoading) {
      const hasAssistantResponse = [...messages].reverse().some(
        (msg) => msg.role === 'assistant' && !msg.isThinking && msg.content
      );
      if (hasAssistantResponse) {
        setShowGenerationActions(true);
      }
    }

    if (!loadingStateRef.current && isLoading) {
      setShowGenerationActions(false);
    }

    loadingStateRef.current = isLoading;
  }, [isLoading, messages]);

  // 开启新对话功能
  const handleNewChat = () => {
    const newChatMessages = [
      { id: 1, role: 'assistant', content: '你好！我是你的AI写作助手。我可以帮助你进行创意构思、内容优化、情节建议等。有什么需要帮助的吗？' }
    ];
    setMessages(newChatMessages);
    // 清空输入框
    setInput('');
    // 重置加载状态
    setIsLoading(false);
    setShowGenerationActions(false);
    setCurrentAiActionLabel('对话建议');
    // 持久化新的聊天记录
    if (setAiChatState && !isUpdatingToState.current) {
      isUpdatingToState.current = true;
      setAiChatState({ messages: newChatMessages });
      setTimeout(() => { isUpdatingToState.current = false; }, 0);
    }
  };

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  // 当消息变化时自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const handleSend = async () => {
    if (input.trim() === '' || isLoading) return;

    // 检查是否有可用的模型配置
    if (modelConfigs.length === 0) {
      const errorMessage = {
        id: messages.length + 1,
        role: 'assistant',
        content: '未找到可用的AI模型配置。请先在设置中添加您的AI服务配置（如OpenAI、Claude、Gemini等）。'
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    // 保存用户输入的内容
    const userInputContent = input;
    const userMessage = { id: messages.length + 1, role: 'user', content: userInputContent };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setCurrentAiActionLabel('续写建议');
    setShowGenerationActions(false);
    setIsLoading(true);

    // 检查是否支持流式输出
    const supportsStream = selectedModelConfig && selectedModelConfig.stream;

    // 立即创建AI消息显示"正在思考中"
    const aiResponseId = messages.length + 2;
    const aiResponse = {
      id: aiResponseId,
      role: 'assistant',
      content: 'AI正在思考中...',
      isThinking: true  // 统一标记为思考状态
    };
    const messagesWithThinking = [...newMessages, aiResponse];
    setMessages(messagesWithThinking);

    let latestAiText = '';

    try {
      if (supportsStream) {
        // 新协议：消费结构化 SSE 事件。useAIWriting 的状态机需要和 isLoading、isThinking、messages 列表协同，
        // 因此这里直接维护 callbacks；通用 useAgentEvents hook 保留给后续 modal 等一次性 AI 调用复用。
        const aiResponseEvents = [];
        let aiTextBuffer = '';

        const updateMessageById = (patch) => {
          setMessages(prev => prev.map(msg =>
            msg.id === aiResponseId ? { ...msg, ...patch } : msg
          ));
        };

        const callbacks = {
          onNodeStart: (payload) => {
            aiResponseEvents.push({ kind: 'node_start', ...payload, ts: Date.now() });
            updateMessageById({ events: [...aiResponseEvents], traceStatus: 'streaming', isThinking: false });
          },
          onNodeEnd: (payload) => {
            aiResponseEvents.push({ kind: 'node_end', ...payload, ts: Date.now() });
            updateMessageById({ events: [...aiResponseEvents] });
          },
          onToolStart: (payload) => {
            aiResponseEvents.push({ kind: 'tool_start', ...payload, ts: Date.now() });
            updateMessageById({ events: [...aiResponseEvents], traceStatus: 'streaming' });
          },
          onToolEnd: (payload) => {
            aiResponseEvents.push({ kind: 'tool_end', ...payload, ts: Date.now() });
            updateMessageById({ events: [...aiResponseEvents] });
          },
          onText: (payload) => {
            const chunk = payload?.chunk || '';
            aiTextBuffer += chunk;
            latestAiText = aiTextBuffer;
            updateMessageById({ content: aiTextBuffer, isThinking: false });
          },
          onError: (payload) => {
            const aiErrorMessage = payload?.message || 'AI 流式错误';
            updateMessageById({
              content: latestAiText || `抱歉，AI服务暂时不可用: ${aiErrorMessage}`,
              traceStatus: 'error',
              errorMessage: aiErrorMessage,
              isThinking: false,
            });
          },
          onDone: () => {
            // 不覆盖 error 状态。
            setMessages(prev => prev.map(msg => {
              if (msg.id !== aiResponseId) return msg;
              if (msg.traceStatus === 'error') return msg;
              return { ...msg, traceStatus: 'done' };
            }));
            setTimeout(() => setIsLoading(false), 100);
          },
        };

        await aiService.chatWithAIStream(
          projectId,
          userInputContent,  // 传入用户当前输入的内容
          newMessages,  // 传入包含用户新消息的聊天历史
          callbacks,
          selectedPromptTemplate?.id  // 传入选中的模板 ID
        );
      } else {
        // 使用普通输出
        const response = await aiService.chatWithAI(projectId, userInputContent, newMessages, selectedPromptTemplate?.id);  // 传入用户输入内容和包含新消息的历史消息，以及模板 ID
        // 更新思考中的消息为实际回复
        setMessages(prev => prev.map(msg =>
          msg.id === aiResponseId
            ? {
                ...msg,
                content: response.content || response.response || '抱歉，我暂时无法回复。', // 直接使用原始内容
                isThinking: false
              }
            : msg
        ));
        setIsLoading(false);
      }
    } catch (error) {
      // 更新现有消息显示错误信息
      setMessages(prev => prev.map(msg =>
        msg.id === aiResponseId
          ? {
              ...msg,
              content: latestAiText || `抱歉，AI服务暂时不可用: ${error.message}`, // 直接使用原始内容
              isThinking: false,
              traceStatus: supportsStream ? 'error' : msg.traceStatus,
              errorMessage: supportsStream ? error.message : msg.errorMessage
            }
          : msg
      ));
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAIAction = async (action) => {
    if (!currentChapter || isLoading) return;

    // 检查是否有可用的模型配置
    if (modelConfigs.length === 0) {
      const errorMessage = {
        id: messages.length + 1,
        role: 'assistant',
        content: '未找到可用的AI模型配置。请先在设置中添加您的AI服务配置（如OpenAI、Claude、Gemini等）。'
      };
      setMessages(prev => [...prev, errorMessage]);
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
    setIsLoading(true);

    // 立即创建AI消息显示"正在思考中"
    const aiResponseId = messages.length + 1;
    const aiResponse = {
      id: aiResponseId,
      role: 'assistant',
      content: 'AI正在思考中...',
      isThinking: true
    };
    const messagesWithThinking = [...messages, aiResponse];
    setMessages(messagesWithThinking);

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
            content: content
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

      // 更新现有消息显示结果
      setMessages(prev => prev.map(msg =>
        msg.id === aiResponseId
          ? {
              ...msg,
              content: response.content || response.suggestions || response.optimized_content || '操作完成', // 直接使用原始内容
              isThinking: false
            }
          : msg
      ));
    } catch (error) {
      // 更新现有消息显示错误
      setMessages(prev => prev.map(msg =>
        msg.id === aiResponseId
          ? {
              ...msg,
              content: `${action} 操作失败: ${error.message}`, // 直接使用原始内容
              isThinking: false
            }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const lastMessage = messages[messages.length - 1];
  const streamingMessageId = (isLoading && lastMessage?.role === 'assistant' && !lastMessage?.isThinking)
    ? lastMessage.id
    : null;

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
    setShowGenerationActions(false);
  };

  const handleRewriteGeneratedResult = () => {
    setShowGenerationActions(false);
    setInput((prev) => prev || '请基于刚才的结果重写一版，保持人物设定与剧情逻辑一致。');
    setTimeout(() => {
      chatInputRef.current?.focus?.();
    }, 0);
  };

  return {
    messages,
    input,
    setInput,
    isLoading,
    showGenerationActions,
    currentAiActionLabel,
    messagesContainerRef,
    chatInputRef,
    handleNewChat,
    handleSend,
    handleKeyPress,
    handleAIAction,
    handleAcceptGeneratedResult,
    handleRewriteGeneratedResult,
    agentStatuses,
    streamingMessageId,
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
