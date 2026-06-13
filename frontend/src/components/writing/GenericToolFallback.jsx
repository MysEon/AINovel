import React from 'react';

const GenericToolFallback = ({ toolName }) => (
  <div className="ai-tool-fallback">
    未识别的工具调用：{toolName || 'unknown'}
  </div>
);

export default GenericToolFallback;
