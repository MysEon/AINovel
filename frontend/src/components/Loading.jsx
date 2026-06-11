import React from 'react';

const Loading = ({ text = '加载中...' }) => (
  <div className="loading-container">
    <div
      className="loading-spinner"
      style={{
        width: '40px',
        height: '40px',
        border: '4px solid var(--border-color)',
        borderTop: '4px solid var(--primary-color)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }}
    />
    <div className="text-base text-center" style={{ color: 'var(--secondary-text-color)' }}>
      {text}
    </div>
  </div>
);

export default Loading;
