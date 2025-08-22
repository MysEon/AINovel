import { useCallback, useRef, useMemo } from 'react';

/**
 * 性能优化工具集
 * 基于Cherry Studio的性能优化理念
 * 包含节流、缓存、RAF等优化技术
 */

/**
 * 节流函数 - 控制函数调用频率
 * @param {Function} func - 要节流的函数
 * @param {number} delay - 延迟时间(ms)
 * @param {Object} options - 配置选项
 * @returns {Function} 节流后的函数
 */
export const throttle = (func, delay = 100, options = {}) => {
  const { leading = true, trailing = true } = options;
  let lastCall = 0;
  let lastCallTimer = null;

  return function throttledFunction(...args) {
    const now = Date.now();
    
    // 首次调用或达到延迟时间
    if (leading && (now - lastCall >= delay)) {
      lastCall = now;
      return func.apply(this, args);
    }
    
    // 设置尾随调用
    if (trailing) {
      clearTimeout(lastCallTimer);
      lastCallTimer = setTimeout(() => {
        lastCall = Date.now();
        func.apply(this, args);
      }, delay - (now - lastCall));
    }
  };
};

/**
 * 防抖函数 - 延迟执行，重复调用会重置延迟
 * @param {Function} func - 要防抖的函数
 * @param {number} delay - 延迟时间(ms)
 * @param {boolean} immediate - 是否立即执行
 * @returns {Function} 防抖后的函数
 */
export const debounce = (func, delay = 300, immediate = false) => {
  let timeout;
  
  return function debouncedFunction(...args) {
    const callNow = immediate && !timeout;
    
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    }, delay);
    
    if (callNow) func.apply(this, args);
  };
};

/**
 * RAF节流 - 使用requestAnimationFrame进行节流
 * @param {Function} func - 要节流的函数
 * @returns {Function} RAF节流后的函数
 */
export const rafThrottle = (func) => {
  let rafId = null;
  let pending = false;
  
  return function rafThrottledFunction(...args) {
    if (!pending) {
      pending = true;
      rafId = requestAnimationFrame(() => {
        func.apply(this, args);
        pending = false;
      });
    }
  };
};

/**
 * LRU缓存实现
 * @param {number} maxSize - 最大缓存大小
 */
export class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (this.cache.has(key)) {
      // 移到最后（最近使用）
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return undefined;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      // 更新现有键
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最旧的项（第一个）
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, value);
  }

  has(key) {
    return this.cache.has(key);
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  // 获取缓存统计信息
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
      usage: (this.cache.size / this.maxSize) * 100
    };
  }
}

/**
 * 智能更新Hook - 基于内容变化智能决定更新策略
 * @param {*} content - 要监控的内容
 * @param {Object} options - 配置选项
 * @returns {Object} 更新控制方法
 */
export const useSmartUpdate = (content, options = {}) => {
  const {
    throttleDelay = 100,
    debounceDelay = 300,
    enableCache = true,
    cacheSize = 50,
    debug = false
  } = options;

  const cache = useMemo(() => enableCache ? new LRUCache(cacheSize) : null, [enableCache, cacheSize]);
  const lastContent = useRef(content);
  const updateCount = useRef(0);
  const lastUpdate = useRef(Date.now());

  // 节流更新函数
  const throttledUpdate = useCallback(
    throttle((newContent, callback) => {
      if (callback) callback(newContent);
      lastContent.current = newContent;
      updateCount.current++;
      lastUpdate.current = Date.now();
    }, throttleDelay),
    [throttleDelay]
  );

  // 防抖更新函数
  const debouncedUpdate = useCallback(
    debounce((newContent, callback) => {
      if (callback) callback(newContent);
      lastContent.current = newContent;
      updateCount.current++;
      lastUpdate.current = Date.now();
    }, debounceDelay),
    [debounceDelay]
  );

  // 智能决策更新方式
  const smartUpdate = useCallback((newContent, callback) => {
    const contentChange = newContent !== lastContent.current;
    const timeSinceLastUpdate = Date.now() - lastUpdate.current;
    
    if (!contentChange) return;

    // 检查缓存
    if (cache && cache.has(newContent)) {
      const cachedResult = cache.get(newContent);
      if (callback) callback(cachedResult);
      return;
    }

    // 决策更新策略
    if (timeSinceLastUpdate < 50) {
      // 频繁更新 - 使用节流
      throttledUpdate(newContent, callback);
    } else if (timeSinceLastUpdate < 200) {
      // 中等频率 - 使用防抖
      debouncedUpdate(newContent, callback);
    } else {
      // 低频更新 - 立即更新
      if (callback) callback(newContent);
      lastContent.current = newContent;
      updateCount.current++;
      lastUpdate.current = Date.now();
    }

    // 缓存结果
    if (cache && newContent) {
      cache.set(newContent, newContent);
    }

    if (debug) {
      console.log('🎯 [SmartUpdate] 更新策略:', {
        变化检测: contentChange,
        距离上次更新: timeSinceLastUpdate,
        更新次数: updateCount.current,
        缓存状态: cache?.getStats()
      });
    }
  }, [cache, throttledUpdate, debouncedUpdate, debug]);

  return {
    smartUpdate,
    getStats: () => ({
      updateCount: updateCount.current,
      lastUpdate: lastUpdate.current,
      cacheStats: cache?.getStats()
    }),
    clearCache: () => cache?.clear()
  };
};

/**
 * 虚拟滚动Hook - 用于渲染大量内容
 * @param {Array} items - 要渲染的项目列表
 * @param {Object} options - 配置选项
 * @returns {Object} 虚拟滚动状态和方法
 */
export const useVirtualScroll = (items = [], options = {}) => {
  const {
    itemHeight = 50,
    containerHeight = 400,
    overscan = 5
  } = options;

  const scrollTop = useRef(0);
  const containerRef = useRef(null);

  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(scrollTop.current / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight),
      items.length - 1
    );

    return {
      start: Math.max(0, startIndex - overscan),
      end: Math.min(items.length - 1, endIndex + overscan)
    };
  }, [items.length, itemHeight, containerHeight, overscan, scrollTop.current]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end + 1);
  }, [items, visibleRange]);

  const handleScroll = useCallback(
    rafThrottle((e) => {
      scrollTop.current = e.target.scrollTop;
    }),
    []
  );

  return {
    containerRef,
    visibleItems,
    visibleRange,
    handleScroll,
    totalHeight: items.length * itemHeight,
    offsetY: visibleRange.start * itemHeight
  };
};

/**
 * 内存使用监控Hook
 * @param {string} componentName - 组件名称
 * @returns {Object} 内存统计信息
 */
export const useMemoryMonitor = (componentName = 'Unknown') => {
  const renderCount = useRef(0);
  const lastMemory = useRef(null);

  const getMemoryInfo = useCallback(() => {
    if (performance.memory) {
      return {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
        timestamp: Date.now()
      };
    }
    return null;
  }, []);

  const logMemoryUsage = useCallback(() => {
    renderCount.current++;
    const currentMemory = getMemoryInfo();
    
    if (currentMemory && lastMemory.current) {
      const memoryDelta = currentMemory.used - lastMemory.current.used;
      
      console.log(`📊 [Memory] ${componentName}:`, {
        渲染次数: renderCount.current,
        当前内存: `${currentMemory.used}MB`,
        内存变化: `${memoryDelta > 0 ? '+' : ''}${memoryDelta}MB`,
        总内存: `${currentMemory.total}MB`
      });
    }
    
    lastMemory.current = currentMemory;
  }, [componentName, getMemoryInfo]);

  return {
    renderCount: renderCount.current,
    getMemoryInfo,
    logMemoryUsage
  };
};

/**
 * 性能计时器Hook
 * @param {string} operation - 操作名称
 * @returns {Object} 计时器方法
 */
export const usePerformanceTimer = (operation = 'Operation') => {
  const timers = useRef(new Map());

  const start = useCallback((label = 'default') => {
    const key = `${operation}_${label}`;
    timers.current.set(key, performance.now());
  }, [operation]);

  const end = useCallback((label = 'default', log = true) => {
    const key = `${operation}_${label}`;
    const startTime = timers.current.get(key);
    
    if (startTime) {
      const duration = performance.now() - startTime;
      timers.current.delete(key);
      
      if (log) {
        console.log(`⏱️ [Timer] ${key}: ${duration.toFixed(2)}ms`);
      }
      
      return duration;
    }
    
    return null;
  }, [operation]);

  const measure = useCallback((label, fn) => {
    start(label);
    const result = fn();
    end(label);
    return result;
  }, [start, end]);

  return { start, end, measure };
};

export default {
  throttle,
  debounce,
  rafThrottle,
  LRUCache,
  useSmartUpdate,
  useVirtualScroll,
  useMemoryMonitor,
  usePerformanceTimer
};