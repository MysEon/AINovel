import React from 'react';

/**
 * 数学公式块组件
 * 支持KaTeX渲染的数学公式显示
 */
const MathBlock = ({ children, className = '', style = {} }) => {
  return (
    <div 
      className={`math-block ${className}`}
      style={{
        margin: '1.5em 0',
        padding: '1em',
        backgroundColor: 'rgba(3, 102, 214, 0.03)',
        border: '1px solid rgba(3, 102, 214, 0.1)',
        borderRadius: '8px',
        textAlign: 'center',
        overflow: 'auto',
        ...style
      }}
    >
      <div 
        className="math-content"
        style={{
          fontSize: '1.1em',
          lineHeight: '1.4'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default MathBlock;