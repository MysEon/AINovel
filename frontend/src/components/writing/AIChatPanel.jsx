import React from 'react';
import { Layout } from 'antd';
import WritingToolbar from './WritingToolbar';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';

const { Sider } = Layout;

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
  messages,
  messagesContainerRef,
  streamingMessageId,
  input,
  setInput,
  handleSend,
  handleKeyPress,
  chatInputRef
}) => {
  return (
    <Sider
      width="45%"
      className={`ai-chat-sider-shell ${isLoading ? 'is-active' : ''}`}
      style={{ background: 'transparent', padding: '0 8px', height: '100%', overflow: 'hidden' }}
    >
      <div className={`ai-chat-drawer ${isLoading ? 'is-open' : ''}`} style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* AI快捷操作按钮 - 固定在顶部 */}
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

        {/* 聊天消息区域 - 固定高度，可滚动 */}
        <div className="ai-chat-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <ChatMessages
            messages={messages}
            messagesContainerRef={messagesContainerRef}
            isLoading={isLoading}
            streamingMessageId={streamingMessageId}
          />

          {/* 输入框区域 - 固定在底部 */}
          <ChatInput
            input={input}
            setInput={setInput}
            isLoading={isLoading}
            handleSend={handleSend}
            handleKeyPress={handleKeyPress}
            chatInputRef={chatInputRef}
          />
        </div>
      </div>
    </Sider>
  );
};

export default AIChatPanel;
