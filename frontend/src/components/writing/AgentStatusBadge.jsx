import React from 'react';

const AgentStatusBadge = ({ name, status, active = false, tone = 'slate' }) => {
  const badgeToneClass = `tone-${tone}`;
  return (
    <div className={`agent-status-badge ${badgeToneClass} ${active ? 'active' : ''}`} title={`${name} · ${status}`}>
      <span className="agent-status-dot" aria-hidden="true" />
      <span className="agent-status-name">{name}</span>
      <span className="agent-status-sep">·</span>
      <span className="agent-status-text">{status}</span>
    </div>
  );
};

export default AgentStatusBadge;
