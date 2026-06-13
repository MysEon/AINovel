import React from 'react';
import { Avatar } from 'antd';
import { FaCopy, FaUser } from 'react-icons/fa';
import { ActionBarPrimitive, MessagePrimitive } from '@assistant-ui/react';
import UserTextMessagePart from './UserTextMessagePart';

const UserMessageRenderer = () => (
  <MessagePrimitive.Root className="chat-message-row user">
    <div className="chat-message-stack user">
      <div className="chat-message-bubble user">
        <MessagePrimitive.Parts
          components={{
            Text: UserTextMessagePart,
          }}
        />
      </div>
      <div className="chat-message-footer user">
        <ActionBarPrimitive.Root className="chat-message-actions user">
          <ActionBarPrimitive.Copy
            className="chat-message-action"
            copiedDuration={1600}
            title="复制"
            aria-label="复制消息"
          >
            <FaCopy />
          </ActionBarPrimitive.Copy>
        </ActionBarPrimitive.Root>
        <span className="chat-message-meta user">用户</span>
      </div>
    </div>
    <Avatar
      className="chat-message-avatar user"
      icon={<FaUser />}
    />
  </MessagePrimitive.Root>
);

export default UserMessageRenderer;
