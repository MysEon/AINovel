import React from 'react';
import { FaSpinner, FaPaperPlane } from 'react-icons/fa';
import { Input } from 'antd';

const { TextArea } = Input;

const ChatInput = ({ input, setInput, isLoading, handleSend, handleKeyPress, chatInputRef }) => {
  return (
    <div className="chat-input-area" style={{ flexShrink: 0 }}>
      <div className={`chat-input-wrapper${input.trim() ? ' has-content' : ''}${isLoading ? ' is-loading' : ''}`}>
        <TextArea
          ref={chatInputRef}
          className="chat-input-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="与AI助手对话，获取写作建议..."
          autoSize={{ minRows: 1, maxRows: 5 }}
          disabled={isLoading}
        />
        <button
          className={`chat-send-btn${input.trim() && !isLoading ? ' active' : ''}`}
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          title="发送 (Enter)"
        >
          {isLoading ? <FaSpinner className="send-spinner" /> : <FaPaperPlane />}
        </button>
      </div>
      <div className="chat-input-hint">
        <span>Enter 发送 · Shift+Enter 换行</span>
      </div>
    </div>
  );
};

export default ChatInput;
