import React from 'react';
import { FaQuoteLeft } from 'react-icons/fa';

/**
 * 引用块组件 - 增强的引用显示
 * 基于Cherry Studio的设计理念
 */
const Quote = ({ 
  children, 
  author,
  source,
  type = 'default', // 'default', 'info', 'warning', 'success', 'error'
  showIcon = true,
  className = '', 
  style = {} 
}) => {
  // 获取引用类型样式
  const getQuoteStyle = () => {
    const baseStyle = {
      margin: '1.5em 0',
      padding: '16px 20px',
      borderRadius: '8px',
      position: 'relative',
      fontStyle: 'italic',
      lineHeight: '1.6',
      ...style
    };

    switch (type) {
      case 'info':
        return {
          ...baseStyle,
          backgroundColor: 'rgba(3, 102, 214, 0.05)',
          borderLeft: '4px solid #0969da',
          color: '#0969da'
        };
      case 'warning':
        return {
          ...baseStyle,
          backgroundColor: 'rgba(255, 193, 7, 0.05)',
          borderLeft: '4px solid #f0ad4e',
          color: '#8a6d3b'
        };
      case 'success':
        return {
          ...baseStyle,
          backgroundColor: 'rgba(40, 167, 69, 0.05)',
          borderLeft: '4px solid #28a745',
          color: '#155724'
        };
      case 'error':
        return {
          ...baseStyle,
          backgroundColor: 'rgba(220, 53, 69, 0.05)',
          borderLeft: '4px solid #dc3545',
          color: '#721c24'
        };
      default:
        return {
          ...baseStyle,
          backgroundColor: 'rgba(108, 117, 125, 0.05)',
          borderLeft: '4px solid #6c757d',
          color: '#495057'
        };
    }
  };

  // 获取引用图标颜色
  const getIconColor = () => {
    switch (type) {
      case 'info': return '#0969da';
      case 'warning': return '#f0ad4e';
      case 'success': return '#28a745';
      case 'error': return '#dc3545';
      default: return '#6c757d';
    }
  };

  return (
    <blockquote 
      className={`markdown-quote markdown-quote-${type} ${className}`}
      style={getQuoteStyle()}
    >
      {/* 引用图标 */}
      {showIcon && (
        <FaQuoteLeft 
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            color: getIconColor(),
            fontSize: '16px',
            opacity: 0.6
          }}
        />
      )}

      {/* 引用内容 */}
      <div 
        className="quote-content"
        style={{
          marginLeft: showIcon ? '24px' : '0',
          fontSize: '15px',
          fontWeight: '400'
        }}
      >
        {children}
      </div>

      {/* 引用来源 */}
      {(author || source) && (
        <footer 
          className="quote-footer"
          style={{
            marginTop: '12px',
            paddingTop: '8px',
            borderTop: `1px solid ${getIconColor()}20`,
            fontSize: '13px',
            fontStyle: 'normal',
            color: '#6c757d',
            textAlign: 'right'
          }}
        >
          {author && <cite className="quote-author">— {author}</cite>}
          {source && (
            <div className="quote-source" style={{ fontSize: '12px', marginTop: '4px' }}>
              出处：{source}
            </div>
          )}
        </footer>
      )}

      {/* 装饰性元素 */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '12px',
          width: '32px',
          height: '2px',
          backgroundColor: getIconColor(),
          opacity: 0.3,
          borderRadius: '1px'
        }}
      />
    </blockquote>
  );
};

export default Quote;