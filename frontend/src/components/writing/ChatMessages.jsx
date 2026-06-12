import React from 'react';
import { FaRobot, FaUser } from 'react-icons/fa';
import { Avatar, Spin } from 'antd';
// 使用官方Streamdown组件 - 修正导入方式
import { Streamdown } from 'streamdown';

const ChatMessages = ({ messages, messagesContainerRef, isLoading, streamingMessageId }) => {
  return (
    <div
      ref={messagesContainerRef}
      className="messages-container ai-chat-container"
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        minHeight: 0, // 关键：允许flex子项收缩
        maxHeight: 'calc(100vh - 350px)' // 限制最大高度，为footer和其他UI元素预留空间
      }}
    >
      {messages.map((message) => {
        const isStreamingMessage = message.id === streamingMessageId;
        const rowRole = message.role === 'user' ? 'user' : 'assistant';

        return (
          <div
            key={message.id}
            className={`chat-message-row ${rowRole} ${message.isThinking ? 'thinking' : ''} ${isStreamingMessage ? 'streaming' : ''}`}
          >
            {message.role === 'assistant' && (
              <Avatar
                className="chat-message-avatar assistant"
                icon={<FaRobot />}
                style={{
                  backgroundColor: 'var(--primary-color)',
                  marginRight: '8px',
                  flexShrink: 0
                }}
              />
            )}
            <div className={`chat-message-stack ${rowRole}`}>
              <div className={`chat-message-bubble ${rowRole}`}>
                {message.role === 'assistant' && message.isThinking ? (
                  <div className="thinking-inline">
                    <Spin size="small" />
                    <span>AI正在思考中...</span>
                  </div>
                ) : message.role === 'assistant' ? (
                  <div className="ai-chat-markdown">
                    <Streamdown
                      key={message.id}
                      parseIncompleteMarkdown={true}
                      className="ai-chat-content streamdown-chat"
                      shikiTheme="github-light"
                    >
                      {(() => {
                        let content = message.content || '';

                        // 修复流式传输导致的不完整代码块标记
                        const codeBlockCount = (content.match(/```/g) || []).length;

                        // 如果代码块标记是奇数个，自动补全结束标记
                        if (codeBlockCount % 2 === 1) {
                          content = content + '\n```';
                        }

                        return content;
                      })()}
                    </Streamdown>
                    {isStreamingMessage && <span className="stream-caret" aria-hidden="true" />}
                  </div>
                ) : (
                  <span className="user-message-text" style={{ whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </span>
                )}
              </div>
              <div className={`chat-message-meta ${rowRole}`}>
                {message.role === 'user' ? '用户' : 'AI助手'}
              </div>
            </div>
            {message.role === 'user' && (
              <Avatar
                className="chat-message-avatar user"
                icon={<FaUser />}
                style={{
                  backgroundColor: 'var(--primary-hover)',
                  marginLeft: '8px',
                  flexShrink: 0
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ChatMessages;
