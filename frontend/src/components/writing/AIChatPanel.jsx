import React from 'react';
import { Layout, Card } from 'antd';
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
        <Card
          className="ai-chat-card"
          style={{
            flex: 1,
            borderRadius: 0,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0, // 关键：允许flex子项收缩
            overflow: 'hidden' // 关键：防止内容溢出
          }}
          bodyStyle={{
            padding: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden' // 关键：防止内容溢出
          }}
        >
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
        </Card>
      </div>
    </Sider>
  );
};

export default AIChatPanel;
