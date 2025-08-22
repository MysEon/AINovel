import React, { useState, useCallback } from 'react';
import { FaCopy, FaCheck } from 'react-icons/fa';

/**
 * 表格组件 - 支持复制和优化显示
 * 基于Cherry Studio的设计理念
 */
const Table = ({ 
  children, 
  enableCopy = true,
  responsive = true,
  className = '', 
  style = {} 
}) => {
  const [copied, setCopied] = useState(false);

  // 提取表格文本内容用于复制
  const extractTableText = useCallback(() => {
    try {
      // 创建临时DOM元素来解析表格内容
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = children.toString();
      
      const rows = tempDiv.querySelectorAll('tr');
      const textRows = [];
      
      rows.forEach(row => {
        const cells = row.querySelectorAll('th, td');
        const cellTexts = Array.from(cells).map(cell => cell.textContent.trim());
        textRows.push(cellTexts.join('\t'));
      });
      
      return textRows.join('\n');
    } catch (error) {
      console.error('提取表格文本失败:', error);
      return '';
    }
  }, [children]);

  // 处理表格复制
  const handleCopy = useCallback(async () => {
    const tableText = extractTableText();
    
    try {
      await navigator.clipboard.writeText(tableText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
      // 回退方案
      const textarea = document.createElement('textarea');
      textarea.value = tableText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [extractTableText]);

  return (
    <div 
      className={`table-container ${className}`}
      style={{
        position: 'relative',
        margin: '1.5em 0',
        border: '1px solid #d0d7de',
        borderRadius: '8px',
        overflow: responsive ? 'auto' : 'visible',
        backgroundColor: '#ffffff',
        ...style
      }}
    >
      {/* 表格操作栏 */}
      {enableCopy && (
        <div 
          className="table-actions"
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            zIndex: 10
          }}
        >
          <button
            onClick={handleCopy}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid #d0d7de',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              color: copied ? '#28a745' : '#656d76',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(4px)'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 1)';
              e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
              e.target.style.boxShadow = 'none';
            }}
            title={copied ? '已复制到剪贴板' : '复制表格内容'}
          >
            {copied ? <FaCheck size={10} /> : <FaCopy size={10} />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      )}

      {/* 表格内容 */}
      <table 
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px',
          lineHeight: '1.5'
        }}
      >
        {children}
      </table>

      {/* 响应式提示 */}
      {responsive && (
        <div 
          className="scroll-hint"
          style={{
            position: 'absolute',
            bottom: '4px',
            right: '8px',
            fontSize: '10px',
            color: '#8b949e',
            pointerEvents: 'none',
            opacity: 0.7
          }}
        >
          可横向滚动
        </div>
      )}
    </div>
  );
};

export default Table;