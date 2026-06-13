import React from 'react';
import { Avatar } from 'antd';
import { FaCopy, FaRedo, FaRobot } from 'react-icons/fa';
import { ActionBarPrimitive, MessagePrimitive } from '@assistant-ui/react';
import TextMessagePart from './TextMessagePart';
import ThinkingTraceToolUI from './ThinkingTraceToolUI';
import GenericToolFallback from './GenericToolFallback';

const AssistantMessageRenderer = () => (
  <MessagePrimitive.Root className="chat-message-row assistant">
    <Avatar
      className="chat-message-avatar assistant"
      icon={<FaRobot />}
    />
    <div className="chat-message-stack assistant">
      <div className="chat-message-bubble assistant">
        <MessagePrimitive.Parts
          components={{
            Text: TextMessagePart,
            tools: {
              by_name: { thinking_trace: ThinkingTraceToolUI },
              Fallback: GenericToolFallback,
            },
          }}
        />
      </div>
      <div className="chat-message-footer assistant">
        <span className="chat-message-meta assistant">AI助手</span>
        <ActionBarPrimitive.Root className="chat-message-actions assistant">
          <ActionBarPrimitive.Copy
            className="chat-message-action"
            copiedDuration={1600}
            title="复制"
            aria-label="复制回复"
          >
            <FaCopy />
          </ActionBarPrimitive.Copy>
          <ActionBarPrimitive.Reload
            className="chat-message-action"
            title="重新生成"
            aria-label="重新生成"
          >
            <FaRedo />
          </ActionBarPrimitive.Reload>
        </ActionBarPrimitive.Root>
      </div>
    </div>
  </MessagePrimitive.Root>
);

export default AssistantMessageRenderer;
