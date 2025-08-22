import { useState, useEffect } from 'react';

/**
 * 持久化状态管理 Hook
 * 自动将状态同步到 localStorage，页面刷新后可以恢复状态
 * 
 * @param {string} key - localStorage 中的键名
 * @param {any} defaultValue - 默认值
 * @returns {[any, function]} - [状态值, 设置状态的函数]
 */
const usePersistentState = (key, defaultValue) => {
  // 初始化状态，优先从 localStorage 读取
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn(`Failed to parse localStorage key "${key}":`, error);
      // 如果解析失败，清除错误数据
      localStorage.removeItem(key);
    }
    return defaultValue;
  });

  // 设置状态并同步到 localStorage
  const setPersistentState = (value) => {
    try {
      setState(value);
      if (value === null || value === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error(`Failed to save to localStorage key "${key}":`, error);
    }
  };

  return [state, setPersistentState];
};

export default usePersistentState;