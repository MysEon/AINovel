import React, { useState, useCallback } from 'react';
import { FaExternalLinkAlt, FaLink } from 'react-icons/fa';

/**
 * 链接组件 - 支持预览和安全处理
 * 基于Cherry Studio的设计理念
 */
const Link = ({ 
  href = '', 
  children, 
  onClick,
  showIcon = true,
  enablePreview = true,
  target = '_blank',
  rel = 'noopener noreferrer',
  className = '', 
  style = {} 
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // 检查链接类型
  const isExternal = href.startsWith('http://') || href.startsWith('https://');
  const isEmail = href.startsWith('mailto:');
  const isPhone = href.startsWith('tel:');
  
  // 处理链接点击
  const handleClick = useCallback((e) => {
    if (onClick) {
      e.preventDefault();
      onClick(href, e);
      return;
    }

    // 安全检查
    if (isExternal) {
      // 确保外部链接安全打开
      if (target === '_blank') {
        e.preventDefault();
        const newWindow = window.open(href, '_blank', 'noopener,noreferrer');
        if (!newWindow) {
          console.warn('弹出窗口被阻止:', href);
        }
      }
    }
  }, [href, onClick, isExternal, target]);

  // 获取链接图标
  const getLinkIcon = () => {
    if (!showIcon) return null;

    if (isEmail) return <span>📧</span>;
    if (isPhone) return <span>📞</span>;
    if (isExternal) return <FaExternalLinkAlt size={10} />;
    return <FaLink size={10} />;
  };

  // 获取链接预览信息
  const getPreviewInfo = () => {
    if (!enablePreview) return null;

    let info = href;
    if (isExternal) {
      try {
        const url = new URL(href);
        info = `${url.hostname}${url.pathname}`;
      } catch (error) {
        info = href;
      }
    }

    return info;
  };

  // 获取链接样式
  const getLinkStyle = () => {
    const baseStyle = {
      color: '#0969da',
      textDecoration: 'none',
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      transition: 'color 0.2s ease, text-decoration 0.2s ease',
      borderRadius: '3px',
      padding: '0 2px',
      ...style
    };

    if (isHovered) {
      baseStyle.color = '#0550ae';
      baseStyle.textDecoration = 'underline';
      baseStyle.backgroundColor = 'rgba(3, 102, 214, 0.05)';
    }

    return baseStyle;
  };

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <a
        href={href}
        target={isExternal ? target : undefined}
        rel={isExternal ? rel : undefined}
        onClick={handleClick}
        className={`markdown-link ${className}`}
        style={getLinkStyle()}
        onMouseEnter={() => {
          setIsHovered(true);
          if (enablePreview) {
            setShowTooltip(true);
          }
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          setShowTooltip(false);
        }}
        onFocus={() => {
          if (enablePreview) {
            setShowTooltip(true);
          }
        }}
        onBlur={() => {
          setShowTooltip(false);
        }}
      >
        <span className="link-text">{children}</span>
        {getLinkIcon()}
      </a>

      {/* 链接预览提示 */}
      {showTooltip && enablePreview && (
        <div
          className="link-tooltip"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            padding: '6px 10px',
            backgroundColor: '#24292e',
            color: '#ffffff',
            fontSize: '12px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            maxWidth: '300px',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {getPreviewInfo()}
          
          {/* 箭头 */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: '4px solid #24292e'
            }}
          />
        </div>
      )}
    </span>
  );
};

export default Link;