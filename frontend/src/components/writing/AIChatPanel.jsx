import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Layout } from 'antd';
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  useThread,
  useThreadRuntime,
} from '@assistant-ui/react';
import { FaArrowUp, FaSpinner, FaStop } from 'react-icons/fa';
import WritingToolbar from './WritingToolbar';
import AssistantMessageRenderer from './AssistantMessageRenderer';
import UserMessageRenderer from './UserMessageRenderer';
import { runChatStream } from '../../runtime/aiNovelChatAdapter';
import './AIChatPanel.assistant-ui.css';

const { Sider } = Layout;

const WELCOME_TEXT = '你好！我是你的AI写作助手。我可以帮助你进行创意构思、内容优化、情节建议等。有什么需要帮助的吗？';

const generateMessageId = () =>
  `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getTextFromContent = (content) => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((part) => part?.type === 'text')
    .map((part) => part.text || '')
    .join('');
};

const toLegacyHistoryMessage = (message) => ({
  role: message.role,
  content: getTextFromContent(message.content),
});

const AssistantThreadBridge = ({ onRunningChange, onNewChatReady, onResetChat }) => {
  const isRunning = useThread((thread) => thread.isRunning);
  const runtime = useThreadRuntime();

  useEffect(() => {
    onRunningChange?.(isRunning);
  }, [isRunning, onRunningChange]);

  useEffect(() => {
    onNewChatReady?.(() => {
      // 优先用受控外部 reset，回退到 runtime.reset
      if (onResetChat) {
        onResetChat();
      } else if (runtime?.reset) {
        runtime.reset();
      }
    });
  }, [runtime, onNewChatReady, onResetChat]);

  return null;
};

const ComposerActionButton = () => {
  const isRunning = useThread((thread) => thread.isRunning);

  if (isRunning) {
    return (
      <div className="aui-composer-action-stack is-running">
        <button
          type="button"
          className="aui-composer-action-button aui-composer-spinner-button chat-send-btn"
          disabled
          title="AI 正在回复"
          aria-label="AI 正在回复"
        >
          <FaSpinner />
        </button>
        <ComposerPrimitive.Cancel
          className="aui-composer-action-button aui-composer-stop-button chat-send-btn"
          title="停止生成"
          aria-label="停止生成"
        >
          <FaStop />
        </ComposerPrimitive.Cancel>
      </div>
    );
  }

  return (
    <div className="aui-composer-action-stack">
      <ComposerPrimitive.Send
        className="aui-composer-action-button aui-composer-send-button chat-send-btn"
        title="发送"
        aria-label="发送"
      >
        <FaArrowUp />
      </ComposerPrimitive.Send>
    </div>
  );
};

// 空状态欢迎语：在 Thread context 内部读 messages，messages.length===0 才渲染
const ThreadEmptyWelcome = () => {
  const messageCount = useThread((thread) => thread.messages.length);
  if (messageCount > 0) return null;
  return (
    <div className="ai-chat-welcome">
      <p>{WELCOME_TEXT}</p>
    </div>
  );
};

// 把我们存储的自定义形态转换为 assistant-ui 的 ThreadMessageLike
// 必须显式提供 convertMessage（即使 messages 已经是 {role, content} 形态），
// 0.14 版本下不传时 useExternalStoreRuntime 初始化会崩在 getThreadState
const convertMessage = (message) => ({
  id: message.id,
  role: message.role,
  content: message.content,
  createdAt: message.createdAt instanceof Date
    ? message.createdAt
    : (message.createdAt ? new Date(message.createdAt) : undefined),
  status: message.status,
});

const AIChatPanel = ({
  isLoading,
  selectedModelConfig,
  selectedPromptTemplate,
  promptTemplates,
  modelConfigs,
  isLoadingTemplates,
  agentStatuses,
  onNewChat,
  onAIAction,
  onModelConfigChange,
  onPromptTemplateSelect,
  onAssistantRunningChange,
  onRegisterNewChat,
  projectId,
  // 受控 messages（来自 useWritingPersistentState，按 projectId 持久化）
  messages = [],
  setMessages,
}) => {
  const abortControllerRef = useRef(null);
  // running 状态由本组件维护（不写入持久化层），切换 isRunning 给 useExternalStoreRuntime
  const [isRunning, setIsRunning] = useState(false);

  // assistant-ui 0.14 在某些 message 形态（缺 metadata）下初始化会崩；
  // 这里用「真实持久化 messages」直接喂给 runtime，空状态由 ThreadPrimitive.Empty 渲染。

  const handleNewChatReset = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setMessages?.([]);
    setIsRunning(false);
  }, [setMessages]);

  const onCancel = useCallback(async () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsRunning(false);
  }, []);

  const onNew = useCallback(async (appendedMessage) => {
    if (!setMessages) return;
    const userText = getTextFromContent(appendedMessage.content).trim();
    if (!userText) return;

    const userMessage = {
      id: generateMessageId(),
      role: 'user',
      content: appendedMessage.content,
      createdAt: new Date(),
    };
    const assistantId = generateMessageId();
    const assistantPlaceholder = {
      id: assistantId,
      role: 'assistant',
      // 占位用一个零宽空格，避免 fromThreadMessageLike 因 trim().length===0 把 part 过滤掉
      // 流式 onUpdate 会立刻把它替换成累积文本
      content: [{ type: 'text', text: '​' }],
      createdAt: new Date(),
    };

    // 历史 = 当前持久化的真实 messages
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map(toLegacyHistoryMessage)
      .filter((m) => m.content);

    // 用 functional updater 避免 messages 闭包捕获旧值（useExternalStoreRuntime
    // 的 store.messages 引用更新有微妙的时序）
    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsRunning(true);

    try {
      await runChatStream({
        projectId,
        userText,
        history,
        selectedPromptTemplate,
        abortSignal: controller.signal,
        onUpdate: (payload) => {
          // payload.content 是累积的完整 content array，每次 emit 用它替换 assistant 消息
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: payload.content, status: payload.status }
                : m
            )
          );
        },
      });
    } catch (err) {
      // runChatStream 已经把 errorMessage 反映到最后一次 onUpdate 中
      // 这里再兜底一层文案，避免 assistant 消息内容彻底空白
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && getTextFromContent(m.content).length === 0
            ? {
                ...m,
                content: [{ type: 'text', text: `抱歉，AI 服务暂时不可用: ${err?.message || '未知错误'}` }],
                status: { type: 'incomplete', reason: 'error', error: err?.message },
              }
            : m
        )
      );
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  }, [setMessages, messages, projectId, selectedPromptTemplate]);

  const runtime = useExternalStoreRuntime({
    isRunning,
    messages,
    convertMessage,
    onNew,
    onCancel,
    setMessages: (next) => {
      setMessages?.(next);
    },
  });

  return (
    <Sider
      width="45%"
      className={`ai-chat-sider-shell ${isLoading ? 'is-active' : ''}`}
    >
      <AssistantRuntimeProvider runtime={runtime}>
        <AssistantThreadBridge
          onRunningChange={onAssistantRunningChange}
          onNewChatReady={onRegisterNewChat}
          onResetChat={handleNewChatReset}
        />
        <div className={`ai-chat-drawer ai-assistant-surface ${isLoading ? 'is-open' : ''}`}>
          <WritingToolbar
            isLoading={isLoading}
            selectedModelConfig={selectedModelConfig}
            selectedPromptTemplate={selectedPromptTemplate}
            promptTemplates={promptTemplates}
            modelConfigs={modelConfigs}
            isLoadingTemplates={isLoadingTemplates}
            agentStatuses={agentStatuses}
            onNewChat={onNewChat}
            onAIAction={onAIAction}
            onModelConfigChange={onModelConfigChange}
            onPromptTemplateSelect={onPromptTemplateSelect}
          />

          <div className="ai-chat-body">
            <ThreadPrimitive.Root className="aui-thread-root">
              <ThreadPrimitive.Viewport
                className="aui-thread-viewport messages-container ai-chat-container"
                autoScroll
              >
                <ThreadEmptyWelcome />
                <ThreadPrimitive.Messages
                  components={{
                    UserMessage: UserMessageRenderer,
                    AssistantMessage: AssistantMessageRenderer,
                  }}
                />
                <ThreadPrimitive.ScrollToBottom className="aui-thread-scroll-bottom">
                  回到底部
                </ThreadPrimitive.ScrollToBottom>

                <ThreadPrimitive.ViewportFooter className="aui-thread-footer">
                  <ComposerPrimitive.Root className="aui-composer-root chat-input-area">
                    <div className="aui-composer-wrapper chat-input-wrapper">
                      <ComposerPrimitive.Input
                        className="aui-composer-input chat-input-textarea"
                        placeholder="和写作助手讨论下一段..."
                        submitMode="enter"
                        minRows={1}
                        maxRows={5}
                      />
                      <div className="aui-composer-actions">
                        <ComposerActionButton />
                      </div>
                    </div>
                  </ComposerPrimitive.Root>
                </ThreadPrimitive.ViewportFooter>
              </ThreadPrimitive.Viewport>
            </ThreadPrimitive.Root>
          </div>
        </div>
      </AssistantRuntimeProvider>
    </Sider>
  );
};

export default AIChatPanel;
