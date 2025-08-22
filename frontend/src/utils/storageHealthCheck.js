/**
 * 本地存储健康检查和恢复工具
 * 用于检测和修复可能损坏的localStorage数据
 */

/**
 * 检查localStorage中的JSON数据是否有效
 * @param {string} key - localStorage键名
 * @returns {boolean} - 数据是否有效
 */
export const isValidLocalStorageData = (key) => {
  try {
    const data = localStorage.getItem(key);
    if (data === null) return true; // null是有效的
    JSON.parse(data);
    return true;
  } catch (error) {
    console.warn(`Invalid localStorage data for key "${key}":`, error);
    return false;
  }
};

/**
 * 安全获取localStorage数据
 * @param {string} key - localStorage键名
 * @param {any} defaultValue - 默认值
 * @returns {any} - 解析后的数据或默认值
 */
export const safeGetLocalStorage = (key, defaultValue = null) => {
  try {
    const data = localStorage.getItem(key);
    if (data === null) return defaultValue;
    
    // 特殊处理token，清理可能的引号包装
    if (key === 'ainovel_token' && typeof data === 'string') {
      const cleanedToken = data.replace(/^"|"$/g, '');
      return cleanedToken;
    }
    
    return JSON.parse(data);
  } catch (error) {
    console.warn(`Failed to parse localStorage data for key "${key}":`, error);
    // 清除损坏的数据
    localStorage.removeItem(key);
    return defaultValue;
  }
};

/**
 * 安全设置localStorage数据
 * @param {string} key - localStorage键名
 * @param {any} value - 要存储的数据
 * @returns {boolean} - 是否成功
 */
export const safeSetLocalStorage = (key, value) => {
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      // 特殊处理token，确保不会有引号包装
      if (key === 'ainovel_token' && typeof value === 'string') {
        const cleanedToken = value.replace(/^"|"$/g, '');
        localStorage.setItem(key, cleanedToken);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    }
    return true;
  } catch (error) {
    console.error(`Failed to save localStorage data for key "${key}":`, error);
    return false;
  }
};

/**
 * 检查并修复所有AINovel相关的localStorage数据
 * @returns {Object} - 检查结果
 */
export const checkAndRepairAppStorage = () => {
  const appKeys = [
    'ainovel_token',
    'ainovel_user',
    'ainovel_last_view',
    'ainovel_current_project'
  ];

  const results = {
    checked: 0,
    corrupted: 0,
    repaired: 0,
    errors: []
  };

  // 检查所有应用相关的键
  for (const key of appKeys) {
    results.checked++;
    
    if (!isValidLocalStorageData(key)) {
      results.corrupted++;
      console.warn(`Repairing corrupted localStorage data for key: ${key}`);
      
      try {
        localStorage.removeItem(key);
        results.repaired++;
      } catch (error) {
        results.errors.push({ key, error: error.message });
        console.error(`Failed to repair localStorage key "${key}":`, error);
      }
    }
  }

  // 检查以特定前缀开头的键（项目相关数据）
  const prefixes = ['ainovel_project_', 'ainovel_chapter_'];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && prefixes.some(prefix => key.startsWith(prefix))) {
      results.checked++;
      
      if (!isValidLocalStorageData(key)) {
        results.corrupted++;
        console.warn(`Repairing corrupted localStorage data for key: ${key}`);
        
        try {
          localStorage.removeItem(key);
          results.repaired++;
        } catch (error) {
          results.errors.push({ key, error: error.message });
          console.error(`Failed to repair localStorage key "${key}":`, error);
        }
      }
    }
  }

  console.log('localStorage health check completed:', results);
  return results;
};

/**
 * 获取localStorage使用情况
 * @returns {Object} - 使用情况统计
 */
export const getStorageUsage = () => {
  let totalSize = 0;
  let ainovelSize = 0;
  let ainovelKeys = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key) || '';
      const size = new Blob([value]).size;
      totalSize += size;

      if (key.startsWith('ainovel_')) {
        ainovelSize += size;
        ainovelKeys++;
      }
    }
  }

  return {
    totalKeys: localStorage.length,
    ainovelKeys,
    totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
    ainovelSizeMB: (ainovelSize / (1024 * 1024)).toFixed(2),
    usagePercentage: totalSize > 0 ? ((ainovelSize / totalSize) * 100).toFixed(1) : 0
  };
};

/**
 * 清理过期的项目数据
 * @param {number} daysOld - 清理多少天前的数据
 * @returns {Object} - 清理结果
 */
export const cleanupOldProjectData = (daysOld = 30) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const results = {
    checked: 0,
    cleaned: 0,
    errors: []
  };

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('ainovel_project_') || key.startsWith('ainovel_chapter_'))) {
      results.checked++;
      
      try {
        const data = safeGetLocalStorage(key);
        if (data && data.lastModified) {
          const lastModified = new Date(data.lastModified);
          if (lastModified < cutoffDate) {
            localStorage.removeItem(key);
            results.cleaned++;
            console.log(`Cleaned up old data for key: ${key}`);
          }
        } else if (data && data.lastInteractionTime) {
          const lastInteraction = new Date(data.lastInteractionTime);
          if (lastInteraction < cutoffDate) {
            localStorage.removeItem(key);
            results.cleaned++;
            console.log(`Cleaned up old data for key: ${key}`);
          }
        }
      } catch (error) {
        results.errors.push({ key, error: error.message });
        console.error(`Error cleaning key "${key}":`, error);
      }
    }
  }

  console.log(`Cleanup completed: checked ${results.checked}, cleaned ${results.cleaned} items`);
  return results;
};

/**
 * 执行完整的存储健康检查和清理
 * @returns {Object} - 完整的操作结果
 */
export const performStorageHealthCheck = () => {
  console.log('Starting comprehensive storage health check...');
  
  const repairResults = checkAndRepairAppStorage();
  const cleanupResults = cleanupOldProjectData();
  const usageStats = getStorageUsage();
  
  const results = {
    repair: repairResults,
    cleanup: cleanupResults,
    usage: usageStats,
    timestamp: new Date().toISOString()
  };
  
  console.log('Storage health check completed:', results);
  return results;
};

export default {
  isValidLocalStorageData,
  safeGetLocalStorage,
  safeSetLocalStorage,
  checkAndRepairAppStorage,
  getStorageUsage,
  cleanupOldProjectData,
  performStorageHealthCheck
};