import React, { useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import useSmoothStream from '../../hooks/useSmoothStream';

// 导入样式
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';
import './EnhancedMarkdown.css';

// 自定义组件
import CodeBlock from './CodeBlock';
import MathBlock from './MathBlock';
import Table from './Table';
import Link from './Link';
import Quote from './Quote';

/**
 * 增强的Markdown渲染组件
 * 基于Cherry Studio的设计理念，集成多种插件和自定义组件
 * 支持平滑流式渲染、数学公式、代码高亮、表格等
 */
const EnhancedMarkdown = ({
  content = '',
  isStreaming = false,
  enableSmoothStream = true,
  enableMath = true,
  enableCodeHighlight = true,
  enableTables = true,
  enableQuotes = true,
  smoothStreamOptions = {},
  className = '',
  style = {},
  onLinkClick,
  debug = false
}) => {
  
  // 平滑流式渲染
  const {
    displayText,
    isAnimating,
    progress,
    isComplete
  } = useSmoothStream(
    content, 
    isStreaming && enableSmoothStream, 
    {
      baseSpeed: 30,
      streamingSpeed: 20,
      batchSize: 2,
      streamingBatchSize: 1,
      debug,
      ...smoothStreamOptions
    }
  );

  // 确定要渲染的文本内容
  const renderContent = enableSmoothStream ? displayText : content;

  // 配置remark插件
  const remarkPlugins = useMemo(() => {
    const plugins = [
      remarkGfm,    // GitHub风格Markdown
      remarkBreaks  // 换行支持
    ];

    if (enableMath) {
      plugins.push(remarkMath); // 数学公式支持
    }

    if (debug) {
      console.log('[EnhancedMarkdown] 已加载的remark插件:', plugins.map(p => p.name));
    }

    return plugins;
  }, [enableMath, debug]);

  // 配置rehype插件
  const rehypePlugins = useMemo(() => {
    const plugins = [];

    if (enableCodeHighlight) {
      plugins.push(rehypeHighlight); // 代码高亮
    }

    if (enableMath) {
      plugins.push(rehypeKatex); // 数学公式渲染
    }

    // 原始HTML支持（谨慎使用）
    plugins.push([rehypeRaw, { passThrough: ['element'] }]);

    if (debug) {
      console.log('[EnhancedMarkdown] 已加载的rehype插件:', plugins.map(p => Array.isArray(p) ? p[0].name : p.name));
    }

    return plugins;
  }, [enableCodeHighlight, enableMath, debug]);

  // 自定义组件映射
  const components = useMemo(() => {
    const componentMap = {
      // 段落组件 - 保持换行和样式
      p: ({ children }) => (
        <p style={{ 
          margin: '0.75em 0', 
          lineHeight: '1.7',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}>
          {children}
        </p>
      ),

      // 标题组件
      h1: ({ children }) => (
        <h1 style={{ 
          fontSize: '1.5em', 
          margin: '1em 0 0.5em 0', 
          fontWeight: 'bold',
          borderBottom: '2px solid #eee',
          paddingBottom: '0.3em'
        }}>
          {children}
        </h1>
      ),
      h2: ({ children }) => (
        <h2 style={{ 
          fontSize: '1.3em', 
          margin: '0.8em 0 0.4em 0', 
          fontWeight: 'bold',
          borderBottom: '1px solid #eee',
          paddingBottom: '0.2em'
        }}>
          {children}
        </h2>
      ),
      h3: ({ children }) => (
        <h3 style={{ 
          fontSize: '1.1em', 
          margin: '0.6em 0 0.3em 0', 
          fontWeight: 'bold'
        }}>
          {children}
        </h3>
      ),

      // 列表组件
      ul: ({ children }) => (
        <ul style={{ 
          margin: '0.5em 0', 
          paddingLeft: '2em',
          listStyleType: 'disc'
        }}>
          {children}
        </ul>
      ),
      ol: ({ children }) => (
        <ol style={{ 
          margin: '0.5em 0', 
          paddingLeft: '2em',
          listStyleType: 'decimal'
        }}>
          {children}
        </ol>
      ),
      li: ({ children }) => (
        <li style={{ 
          margin: '0.2em 0',
          lineHeight: '1.6'
        }}>
          {children}
        </li>
      ),

      // 代码组件
      code: ({ inline, className, children, ...props }) => {
        const match = /language-(\w+)/.exec(className || '');
        const language = match ? match[1] : null;
        
        if (!inline && language) {
          return <CodeBlock language={language} code={String(children).replace(/\n$/, '')} />;
        }
        
        return (
          <code
            style={{
              backgroundColor: 'rgba(27,31,35,0.05)',
              padding: '0.2em 0.4em',
              borderRadius: '3px',
              fontSize: '0.9em',
              fontFamily: 'Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
            }}
            {...props}
          >
            {children}
          </code>
        );
      },

      pre: ({ children }) => (
        <pre style={{
          backgroundColor: 'rgba(27,31,35,0.05)',
          padding: '16px',
          borderRadius: '8px',
          margin: '1em 0',
          overflow: 'auto',
          fontSize: '0.9em',
          fontFamily: 'Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          lineHeight: '1.4'
        }}>
          {children}
        </pre>
      ),

      // 强调组件
      strong: ({ children }) => (
        <strong style={{ fontWeight: 'bold', color: '#24292e' }}>{children}</strong>
      ),
      em: ({ children }) => (
        <em style={{ fontStyle: 'italic', color: '#6a737d' }}>{children}</em>
      ),

      // 分割线
      hr: () => (
        <hr style={{
          border: 'none',
          borderTop: '1px solid #eaecef',
          margin: '1.5em 0'
        }} />
      )
    };

    // 数学公式组件
    if (enableMath) {
      componentMap.div = ({ className, children }) => {
        if (className === 'math math-display') {
          return <MathBlock>{children}</MathBlock>;
        }
        return <div className={className}>{children}</div>;
      };
      
      componentMap.span = ({ className, children }) => {
        if (className === 'math math-inline') {
          return <span className="inline-math">{children}</span>;
        }
        return <span className={className}>{children}</span>;
      };
    }

    // 表格组件
    if (enableTables) {
      componentMap.table = ({ children }) => <Table>{children}</Table>;
    }

    // 引用组件
    if (enableQuotes) {
      componentMap.blockquote = ({ children }) => <Quote>{children}</Quote>;
    }

    // 链接组件
    componentMap.a = ({ href, children }) => (
      <Link href={href} onClick={onLinkClick}>
        {children}
      </Link>
    );

    return componentMap;
  }, [enableMath, enableTables, enableQuotes, onLinkClick]);

  // 处理Markdown渲染错误
  const handleError = useCallback((error) => {
    console.error('[EnhancedMarkdown] 渲染错误:', error);
    return (
      <div style={{
        color: '#d73a49',
        backgroundColor: '#ffeef0',
        padding: '0.5em',
        borderRadius: '4px',
        border: '1px solid #fdaeb7'
      }}>
        Markdown渲染出错: {error.message}
      </div>
    );
  }, []);

  if (debug) {
    console.log('[EnhancedMarkdown] 渲染状态:', {
      原始内容长度: content.length,
      显示内容长度: renderContent.length,
      流式状态: isStreaming,
      动画状态: isAnimating,
      渲染进度: progress,
      是否完成: isComplete
    });
  }

  return (
    <div 
      className={`enhanced-markdown ${className} ${isAnimating ? 'streaming' : ''}`}
      style={{
        position: 'relative',
        ...style
      }}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
        skipHtml={false}
        onError={handleError}
      >
        {renderContent}
      </ReactMarkdown>
      
      {/* 流式渲染状态指示器 */}
      {enableSmoothStream && isAnimating && (
        <div className="streaming-indicator">
          <div className="streaming-progress" style={{ width: `${progress}%` }} />
        </div>
      )}
      
      {/* 调试信息 */}
      {debug && (
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '4px 8px',
          fontSize: '12px',
          borderRadius: '0 0 0 4px'
        }}>
          {isAnimating ? `渲染中 ${Math.round(progress)}%` : '完成'}
        </div>
      )}
    </div>
  );
};

export default EnhancedMarkdown;