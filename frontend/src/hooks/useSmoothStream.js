import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 平滑流式渲染Hook - 基于Cherry Studio的设计理念
 * 实现字符级别的平滑显示效果，使用RAF优化渲染性能
 * 
 * @param {string} targetText - 目标文本内容
 * @param {boolean} isStreaming - 是否正在流式输入
 * @param {Object} options - 配置选项
 * @returns {Object} 渲染状态和控制方法
 */
const useSmoothStream = (targetText = '', isStreaming = false, options = {}) => {
  const {
    // 渲染速度配置
    baseSpeed = 50,           // 基础渲染间隔(ms)
    streamingSpeed = 30,      // 流式时的快速渲染间隔(ms)  
    batchSize = 3,            // 每批渲染的字符数
    streamingBatchSize = 1,   // 流式时每批渲染的字符数
    
    // 性能优化配置
    useRAF = true,            // 是否使用requestAnimationFrame
    enableSegmentation = true, // 是否启用智能字符分割
    
    // 调试配置
    debug = false
  } = options;

  // 状态管理
  const [displayText, setDisplayText] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Refs管理
  const rafIdRef = useRef(null);
  const timeoutIdRef = useRef(null);
  const segmenterRef = useRef(null);
  const textSegmentsRef = useRef([]);
  const lastTargetTextRef = useRef('');
  const isRunningRef = useRef(false);

  // 初始化字符分割器
  const initSegmenter = useCallback(() => {
    if (!enableSegmentation || !('Intl' in window) || !('Segmenter' in window.Intl)) {
      if (debug) console.log('[useSmoothStream] Segmenter不可用，使用字符分割');
      return null;
    }

    try {
      segmenterRef.current = new Intl.Segmenter('zh-CN', { 
        granularity: 'grapheme' 
      });
      if (debug) console.log('[useSmoothStream] Segmenter初始化成功');
      return segmenterRef.current;
    } catch (error) {
      if (debug) console.warn('[useSmoothStream] Segmenter初始化失败:', error);
      return null;
    }
  }, [enableSegmentation, debug]);

  // 智能分割文本为字符或词单元
  const segmentText = useCallback((text) => {
    if (!text) return [];

    const segmenter = segmenterRef.current || initSegmenter();
    
    if (segmenter) {
      try {
        const segments = Array.from(segmenter.segment(text)).map(seg => seg.segment);
        if (debug) {
          console.log('[useSmoothStream] 智能分割结果:', {
            原文长度: text.length,
            分割数量: segments.length,
            前10个分割: segments.slice(0, 10)
          });
        }
        return segments;
      } catch (error) {
        if (debug) console.warn('[useSmoothStream] 分割失败，回退到字符分割:', error);
      }
    }

    // 回退到简单字符分割
    const segments = Array.from(text);
    if (debug) {
      console.log('[useSmoothStream] 字符分割结果:', {
        原文长度: text.length,
        分割数量: segments.length
      });
    }
    return segments;
  }, [initSegmenter, debug]);

  // 渲染下一批字符
  const renderNextBatch = useCallback(() => {
    if (isRunningRef.current || currentIndex >= textSegmentsRef.current.length) {
      setIsAnimating(false);
      isRunningRef.current = false;
      return;
    }

    isRunningRef.current = true;
    
    const currentBatchSize = isStreaming ? streamingBatchSize : batchSize;
    const endIndex = Math.min(currentIndex + currentBatchSize, textSegmentsRef.current.length);
    
    // 拼接当前批次的字符
    const batchText = textSegmentsRef.current.slice(0, endIndex).join('');
    
    if (debug && endIndex > currentIndex) {
      console.log('[useSmoothStream] 渲染批次:', {
        当前索引: currentIndex,
        结束索引: endIndex,
        批次大小: endIndex - currentIndex,
        批次内容: textSegmentsRef.current.slice(currentIndex, endIndex),
        显示文本长度: batchText.length
      });
    }

    setDisplayText(batchText);
    setCurrentIndex(endIndex);
    
    isRunningRef.current = false;
    
    // 如果还有内容需要渲染，继续下一批
    if (endIndex < textSegmentsRef.current.length) {
      const speed = isStreaming ? streamingSpeed : baseSpeed;
      
      if (useRAF) {
        rafIdRef.current = requestAnimationFrame(() => {
          timeoutIdRef.current = setTimeout(renderNextBatch, speed);
        });
      } else {
        timeoutIdRef.current = setTimeout(renderNextBatch, speed);
      }
    } else {
      setIsAnimating(false);
      if (debug) console.log('[useSmoothStream] 渲染完成');
    }
  }, [currentIndex, isStreaming, streamingBatchSize, batchSize, streamingSpeed, baseSpeed, useRAF, debug]);

  // 开始平滑渲染
  const startSmoothing = useCallback(() => {
    if (isRunningRef.current) return;
    
    setIsAnimating(true);
    
    // 如果正在流式输入且文本没有变化，立即显示所有内容
    if (isStreaming && lastTargetTextRef.current === targetText) {
      setDisplayText(targetText);
      setCurrentIndex(textSegmentsRef.current.length);
      setIsAnimating(false);
      return;
    }

    // 更新文本分割
    lastTargetTextRef.current = targetText;
    textSegmentsRef.current = segmentText(targetText);
    
    if (debug) {
      console.log('[useSmoothStream] 开始渲染:', {
        目标文本: targetText,
        分割片段数: textSegmentsRef.current.length,
        流式状态: isStreaming
      });
    }

    // 开始渲染
    renderNextBatch();
  }, [targetText, isStreaming, segmentText, renderNextBatch, debug]);

  // 停止渲染动画
  const stopSmoothing = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    setIsAnimating(false);
    isRunningRef.current = false;
    
    if (debug) console.log('[useSmoothStream] 停止渲染');
  }, [debug]);

  // 立即显示所有内容
  const showComplete = useCallback(() => {
    stopSmoothing();
    setDisplayText(targetText);
    setCurrentIndex(segmentText(targetText).length);
    if (debug) console.log('[useSmoothStream] 立即显示完整内容');
  }, [targetText, segmentText, stopSmoothing, debug]);

  // 重置状态
  const reset = useCallback(() => {
    stopSmoothing();
    setDisplayText('');
    setCurrentIndex(0);
    textSegmentsRef.current = [];
    lastTargetTextRef.current = '';
    if (debug) console.log('[useSmoothStream] 重置状态');
  }, [stopSmoothing, debug]);

  // 监听目标文本变化
  useEffect(() => {
    if (!targetText) {
      reset();
      return;
    }

    // 如果文本变化了，重新开始渲染
    if (targetText !== lastTargetTextRef.current) {
      setCurrentIndex(0);
      startSmoothing();
    }
  }, [targetText, startSmoothing, reset]);

  // 监听流式状态变化
  useEffect(() => {
    if (!isStreaming && isAnimating) {
      // 流式结束时，加快渲染剩余内容
      if (debug) console.log('[useSmoothStream] 流式结束，加快渲染');
      startSmoothing();
    }
  }, [isStreaming, isAnimating, startSmoothing, debug]);

  // 清理资源
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  // 返回状态和控制方法
  return {
    // 显示状态
    displayText,           // 当前显示的文本
    isAnimating,          // 是否正在动画中
    progress: textSegmentsRef.current.length > 0 
      ? (currentIndex / textSegmentsRef.current.length) * 100 
      : 0,                // 渲染进度 (0-100)
    
    // 控制方法
    startSmoothing,       // 开始平滑渲染
    stopSmoothing,        // 停止渲染
    showComplete,         // 立即显示完整内容  
    reset,               // 重置状态
    
    // 状态信息
    segmentCount: textSegmentsRef.current.length, // 分割片段数量
    currentIndex,         // 当前渲染索引
    isComplete: currentIndex >= textSegmentsRef.current.length, // 是否渲染完成
  };
};

export default useSmoothStream;