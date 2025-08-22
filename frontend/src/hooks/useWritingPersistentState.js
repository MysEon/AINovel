import { useState, useEffect, useCallback, useRef } from 'react';
import storageCleanup from '../utils/storageCleanup';

/**
 * 写作页面增强型持久化状态管理 Hook
 * 支持分层次的状态管理：项目级状态、章节级状态
 * 
 * @param {number} projectId - 项目ID
 * @param {number} chapterId - 章节ID
 * @returns {Object} - 返回状态管理对象
 */
const useWritingPersistentState = (projectId, chapterId) => {
  // 状态恢复进度
  const [restorationProgress, setRestorationProgress] = useState(0);
  const [isRestoring, setIsRestoring] = useState(false);
  const restorationSteps = useRef([]);

  // 项目级写作状态
  const [writingState, setWritingStateInternal] = useState({
    aiAssisted: false,
    aiMode: 'optimize', // 'optimize' | 'takeover'
    layoutMode: 'left', // 'left' | 'right'
    selectedModelConfigId: null
  });

  // 章节级AI聊天状态
  const [aiChatState, setAiChatStateInternal] = useState({
    messages: [],
    lastInteractionTime: null
  });

  // 章节级草稿状态
  const [draftState, setDraftStateInternal] = useState({
    content: '',
    lastModified: null,
    cursorPosition: 0,
    scrollPosition: 0
  });

  /**
   * 生成存储键名
   */
  const getStorageKey = useCallback((type, id) => {
    switch (type) {
      case 'project_writing':
        return `ainovel_project_${id}_writing_state`;
      case 'chapter_chat':
        return `ainovel_chapter_${id}_ai_chat`;
      case 'chapter_draft':
        return `ainovel_chapter_${id}_draft`;
      default:
        return `ainovel_${type}`;
    }
  }, []);

  /**
   * 安全的localStorage读取
   */
  const safeLocalStorageGet = useCallback((key, defaultValue = null) => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn(`Failed to parse localStorage key "${key}":`, error);
      localStorage.removeItem(key);
    }
    return defaultValue;
  }, []);

  /**
   * 安全的localStorage保存
   */
  const safeLocalStorageSet = useCallback((key, value) => {
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
      return true;
    } catch (error) {
      console.error(`Failed to save to localStorage key "${key}":`, error);
      // 如果存储失败，尝试清理一些旧数据
      if (error.name === 'QuotaExceededError') {
        const cleanupResult = storageCleanup.handleQuotaExceeded();
        console.log('Emergency cleanup result:', cleanupResult);
        
        // 再次尝试存储
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (retryError) {
          console.error('Storage retry failed after cleanup:', retryError);
        }
      }
      return false;
    }
  }, []);

  /**
   * 清理过期数据
   */
  const cleanupExpiredData = useCallback(() => {
    const result = storageCleanup.cleanupExpiredData();
    console.log(`Cleaned up ${result.cleanedCount} expired items, freed ${result.cleanedSizeMB.toFixed(2)}MB`);
    return result;
  }, []);

  /**
   * 渐进式状态恢复
   */
  const restoreStates = useCallback(async () => {
    if (!projectId || !chapterId) return;

    setIsRestoring(true);
    setRestorationProgress(0);
    restorationSteps.current = [];

    const steps = [
      { name: '恢复项目设置', weight: 30 },
      { name: '恢复AI聊天记录', weight: 50 },
      { name: '恢复草稿内容', weight: 20 }
    ];

    let currentProgress = 0;

    try {
      // 步骤1: 恢复项目级状态
      restorationSteps.current.push(steps[0].name);
      const projectKey = getStorageKey('project_writing', projectId);
      const savedWritingState = safeLocalStorageGet(projectKey);
      
      if (savedWritingState) {
        setWritingStateInternal(prevState => ({
          ...prevState,
          ...savedWritingState
        }));
      }
      
      currentProgress += steps[0].weight;
      setRestorationProgress(currentProgress);
      await new Promise(resolve => setTimeout(resolve, 100)); // 模拟异步恢复

      // 步骤2: 恢复章节级AI聊天状态
      restorationSteps.current.push(steps[1].name);
      const chatKey = getStorageKey('chapter_chat', chapterId);
      const savedChatState = safeLocalStorageGet(chatKey);
      
      if (savedChatState && savedChatState.messages) {
        setAiChatStateInternal(savedChatState);
      }
      
      currentProgress += steps[1].weight;
      setRestorationProgress(currentProgress);
      await new Promise(resolve => setTimeout(resolve, 100));

      // 步骤3: 恢复章节级草稿状态
      restorationSteps.current.push(steps[2].name);
      const draftKey = getStorageKey('chapter_draft', chapterId);
      const savedDraftState = safeLocalStorageGet(draftKey);
      
      if (savedDraftState) {
        setDraftStateInternal(prevState => ({
          ...prevState,
          ...savedDraftState
        }));
      }
      
      currentProgress += steps[2].weight;
      setRestorationProgress(currentProgress);
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error('State restoration failed:', error);
    } finally {
      setIsRestoring(false);
      setRestorationProgress(100);
    }
  }, [projectId, chapterId, getStorageKey, safeLocalStorageGet]);

  /**
   * 设置项目级写作状态
   */
  const setWritingState = useCallback((value) => {
    if (!projectId) return;
    
    const newState = typeof value === 'function' ? value(writingState) : value;
    setWritingStateInternal(newState);
    
    const key = getStorageKey('project_writing', projectId);
    safeLocalStorageSet(key, newState);
  }, [projectId, writingState, getStorageKey, safeLocalStorageSet]);

  /**
   * 设置章节级AI聊天状态
   */
  const setAiChatState = useCallback((value) => {
    if (!chapterId) return;
    
    const newState = typeof value === 'function' ? value(aiChatState) : value;
    // 更新最后交互时间
    const stateWithTimestamp = {
      ...newState,
      lastInteractionTime: new Date().toISOString()
    };
    
    setAiChatStateInternal(stateWithTimestamp);
    
    const key = getStorageKey('chapter_chat', chapterId);
    safeLocalStorageSet(key, stateWithTimestamp);
  }, [chapterId, aiChatState, getStorageKey, safeLocalStorageSet]);

  /**
   * 设置章节级草稿状态
   */
  const setDraftState = useCallback((value) => {
    if (!chapterId) return;
    
    const newState = typeof value === 'function' ? value(draftState) : value;
    const stateWithTimestamp = {
      ...newState,
      lastModified: new Date().toISOString()
    };
    
    setDraftStateInternal(stateWithTimestamp);
    
    const key = getStorageKey('chapter_draft', chapterId);
    safeLocalStorageSet(key, stateWithTimestamp);
  }, [chapterId, draftState, getStorageKey, safeLocalStorageSet]);

  /**
   * 清理指定章节的数据
   */
  const clearChapterData = useCallback((targetChapterId) => {
    const chatKey = getStorageKey('chapter_chat', targetChapterId);
    const draftKey = getStorageKey('chapter_draft', targetChapterId);
    
    localStorage.removeItem(chatKey);
    localStorage.removeItem(draftKey);
  }, [getStorageKey]);

  /**
   * 获取存储使用情况统计
   */
  const getStorageStats = useCallback(() => {
    return storageCleanup.getStorageUsage();
  }, []);

  /**
   * 获取存储健康状态
   */
  const getStorageHealth = useCallback(() => {
    return storageCleanup.getStorageHealthStatus();
  }, []);

  /**
   * 执行智能清理
   */
  const performSmartCleanup = useCallback(() => {
    return storageCleanup.smartCleanup();
  }, []);

  // 定期检查存储健康状态
  useEffect(() => {
    const checkStorageHealth = () => {
      const health = getStorageHealth();
      
      if (health.status === 'critical') {
        console.warn('Storage space critical, performing automatic cleanup...');
        performSmartCleanup();
      } else if (health.status === 'warning') {
        console.info('Storage space warning:', health.recommendation);
      }
    };

    // 页面加载时检查一次
    checkStorageHealth();
    
    // 每5分钟检查一次
    const interval = setInterval(checkStorageHealth, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [getStorageHealth, performSmartCleanup]);

  // 当项目或章节ID变化时，恢复状态
  useEffect(() => {
    if (projectId && chapterId) {
      restoreStates();
    }
  }, [projectId, chapterId, restoreStates]);

  // 页面卸载时清理过期数据
  useEffect(() => {
    const handleBeforeUnload = () => {
      cleanupExpiredData();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [cleanupExpiredData]);

  return {
    // 状态
    writingState,
    aiChatState, 
    draftState,
    
    // 状态设置器
    setWritingState,
    setAiChatState,
    setDraftState,
    
    // 恢复状态
    isRestoring,
    restorationProgress,
    restorationSteps: restorationSteps.current,
    
    // 工具方法
    clearChapterData,
    cleanupExpiredData,
    getStorageStats,
    getStorageHealth,
    performSmartCleanup
  };
};

export default useWritingPersistentState;