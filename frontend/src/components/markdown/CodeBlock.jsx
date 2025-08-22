import React, { useState, useCallback } from 'react';
import { FaCopy, FaCheck } from 'react-icons/fa';

/**
 * 代码块组件 - 支持语法高亮和复制功能
 * 基于Cherry Studio的设计理念
 */
const CodeBlock = ({ 
  language = '', 
  code = '', 
  showLineNumbers = true,
  enableCopy = true,
  maxHeight = '400px',
  className = '',
  style = {}
}) => {
  const [copied, setCopied] = useState(false);

  // 处理代码复制
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
      // 回退方案：创建临时textarea
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  // 获取语言显示名称
  const getLanguageDisplayName = (lang) => {
    const languageMap = {
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'python': 'Python',
      'java': 'Java',
      'cpp': 'C++',
      'csharp': 'C#',
      'php': 'PHP',
      'ruby': 'Ruby',
      'go': 'Go',
      'rust': 'Rust',
      'sql': 'SQL',
      'json': 'JSON',
      'xml': 'XML',
      'html': 'HTML',
      'css': 'CSS',
      'scss': 'SCSS',
      'bash': 'Bash',
      'shell': 'Shell',
      'powershell': 'PowerShell',
      'dockerfile': 'Dockerfile',
      'yaml': 'YAML',
      'yml': 'YAML',
      'markdown': 'Markdown',
      'jsx': 'React JSX',
      'tsx': 'React TSX'
    };
    return languageMap[lang.toLowerCase()] || lang.toUpperCase();
  };

  // 生成行号
  const renderLineNumbers = () => {
    if (!showLineNumbers) return null;
    
    const lines = code.split('\n');
    return (
      <div 
        className="code-line-numbers"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '40px',
          backgroundColor: 'rgba(0, 0, 0, 0.03)',
          borderRight: '1px solid rgba(0, 0, 0, 0.1)',
          padding: '12px 8px',
          fontSize: '12px',
          lineHeight: '1.5',
          color: '#6a737d',
          textAlign: 'right',
          userSelect: 'none',
          fontFamily: 'Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
        }}
      >
        {lines.map((_, index) => (
          <div key={index} style={{ height: '21px' }}>
            {index + 1}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div 
      className={`code-block-container ${className}`}
      style={{
        position: 'relative',
        margin: '1em 0',
        borderRadius: '8px',
        border: '1px solid #e1e4e8',
        overflow: 'hidden',
        backgroundColor: '#f6f8fa',
        ...style
      }}
    >
      {/* 代码块头部 */}
      <div 
        className="code-block-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: 'rgba(0, 0, 0, 0.03)',
          borderBottom: '1px solid #e1e4e8',
          fontSize: '12px',
          color: '#6a737d'
        }}
      >
        <span className="language-label">
          {language ? getLanguageDisplayName(language) : '代码'}
        </span>
        
        {enableCopy && (
          <button
            onClick={handleCopy}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              color: copied ? '#28a745' : '#6a737d',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              transition: 'color 0.2s ease, background-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
            }}
            title={copied ? '已复制' : '复制代码'}
          >
            {copied ? <FaCheck size={12} /> : <FaCopy size={12} />}
            {copied ? '已复制' : '复制'}
          </button>
        )}
      </div>

      {/* 代码内容区域 */}
      <div 
        className="code-block-content"
        style={{
          position: 'relative',
          maxHeight,
          overflow: 'auto'
        }}
      >
        {renderLineNumbers()}
        
        <pre
          style={{
            margin: 0,
            padding: showLineNumbers ? '12px 12px 12px 52px' : '12px',
            backgroundColor: 'transparent',
            border: 'none',
            fontSize: '13px',
            lineHeight: '1.5',
            fontFamily: 'Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            overflow: 'visible',
            whiteSpace: 'pre',
            wordWrap: 'normal'
          }}
        >
          <code 
            className={language ? `language-${language}` : ''}
            style={{
              backgroundColor: 'transparent',
              padding: 0,
              borderRadius: 0,
              fontSize: 'inherit',
              fontFamily: 'inherit'
            }}
          >
            {code}
          </code>
        </pre>
      </div>

      {/* 滚动阴影效果 */}
      <div 
        className="scroll-shadow"
        style={{
          position: 'absolute',
          top: '41px', // header height
          left: 0,
          right: 0,
          height: '8px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), transparent)',
          pointerEvents: 'none',
          opacity: 0
        }}
      />
    </div>
  );
};

export default CodeBlock;