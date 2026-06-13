import React from 'react';
import { Streamdown } from 'streamdown';
import { formatAssistantMarkdownForRender } from '../../utils/aiMarkdownRenderer';

const TextMessagePart = ({ text = '', status }) => {
  const isStreaming = status?.type === 'running';

  return (
    <div className="ai-chat-markdown">
      <Streamdown
        parseIncompleteMarkdown={true}
        className="ai-chat-content streamdown-chat"
        shikiTheme="github-light"
      >
        {formatAssistantMarkdownForRender(text)}
      </Streamdown>
      {isStreaming && <span className="stream-caret" aria-hidden="true" />}
    </div>
  );
};

export default TextMessagePart;
