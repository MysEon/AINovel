import React, { useEffect, useMemo } from 'react';
import { Layout } from 'antd';
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ThreadPrimitive,
  useLocalRuntime,
  useThread,
  useThreadRuntime,
} from '@assistant-ui/react';
import { FaArrowUp, FaSpinner, FaStop } from 'react-icons/fa';
import WritingToolbar from './WritingToolbar';
import AssistantMessageRenderer from './AssistantMessageRenderer';
import UserMessageRenderer from './UserMessageRenderer';
import { createAINovelChatAdapter } from '../../runtime/aiNovelChatAdapter';
import './AIChatPanel.assistant-ui.css';

const { Sider } = Layout;

const INITIAL_MESSAGES = [
  {
    role: 'assistant',
    content: '你好！我是你的AI写作助手。我可以帮助你进行创意构思、内容优化、情节建议等。有什么需要帮助的吗？',
  },
];

const AssistantThreadBridge = ({ onRunningChange, onNewChatReady }) => {
  const isRunning = useThread((thread) => thread.isRunning);
  const runtime = useThreadRuntime();

  useEffect(() => {
    onRunningChange?.(isRunning);
  }, [isRunning, onRunningChange]);

  useEffect(() => {
    onNewChatReady?.(() => runtime.reset(INITIAL_MESSAGES));
  }, [runtime, onNewChatReady]);

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
}) => {
  const adapter = useMemo(() => createAINovelChatAdapter({
    projectId,
    selectedPromptTemplate,
  }), [projectId, selectedPromptTemplate]);

  const runtime = useLocalRuntime(adapter, {
    initialMessages: INITIAL_MESSAGES,
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
