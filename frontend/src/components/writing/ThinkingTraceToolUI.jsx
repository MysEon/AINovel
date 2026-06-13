import React from 'react';
import AIThinkingTrace from './AIThinkingTrace';

const ThinkingTraceToolUI = ({ args }) => {
  const { events = [], status = 'streaming', errorMessage = null } = args || {};

  return (
    <AIThinkingTrace
      events={events}
      status={status}
      errorMessage={errorMessage}
    />
  );
};

export default ThinkingTraceToolUI;
