/**
 * AINovel 数据清理工具
 * 智能管理localStorage存储空间，防止空间不足
 */

// 存储限制常量
const STORAGE_LIMITS = {
  MAX_CHAT_MESSAGES_PER_CHAPTER: 100,    // 每个章节最多保留100条聊天记录
  MAX_DRAFT_VERSIONS_PER_CHAPTER: 5,     // 每个章节最多保留5个草稿版本
  MAX_STORAGE_AGE_DAYS: 30,              // 数据最大保存30天
  WARNING_STORAGE_SIZE_MB: 4,             // 警告阈值：4MB
  MAX_STORAGE_SIZE_MB: 5,                 // 强制清理阈值：5MB
  CLEANUP_BATCH_SIZE: 10                  // 每次清理的批次大小
};

/**
 * 获取localStorage使用情况统计
 */
export const getStorageUsage = () => {
  const stats = {
    totalKeys: 0,
    totalSize: 0,
    totalSizeMB: 0,
    keysByType: {
      project: 0,
      chapter_chat: 0,
      chapter_draft: 0,
      app_settings: 0,
      other: 0
    },
    sizeByType: {
      project: 0,
      chapter_chat: 0,
      chapter_draft: 0,
      app_settings: 0,
      other: 0
    },
    oldestData: null,
    newestData: null
  };

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    try {
      const value = localStorage.getItem(key);
      const size = new Blob([value]).size;
      
      stats.totalKeys++;
      stats.totalSize += size;
      
      // 分类统计
      let type = 'other';
      if (key.startsWith('ainovel_')) {
        if (key.includes('_project_')) {
          type = 'project';
        } else if (key.includes('_chapter_') && key.endsWith('_ai_chat')) {
          type = 'chapter_chat';
        } else if (key.includes('_chapter_') && key.endsWith('_draft')) {
          type = 'chapter_draft';
        } else {
          type = 'app_settings';
        }
      }
      
      stats.keysByType[type]++;
      stats.sizeByType[type] += size;
      
      // 尝试解析时间戳以找到最新/最旧数据
      if (key.startsWith('ainovel_chapter_') && (key.endsWith('_ai_chat') || key.endsWith('_draft'))) {
        try {
          const data = JSON.parse(value);
          const timestamp = data.lastInteractionTime || data.lastModified;
          if (timestamp) {
            const date = new Date(timestamp);
            if (!stats.oldestData || date < stats.oldestData.date) {
              stats.oldestData = { key, date, size };
            }
            if (!stats.newestData || date > stats.newestData.date) {
              stats.newestData = { key, date, size };
            }
          }
        } catch (e) {
          // 忽略解析错误的数据
        }
      }
    } catch (error) {
      console.warn(`Failed to analyze key "${key}":`, error);
    }
  }
  
  stats.totalSizeMB = stats.totalSize / (1024 * 1024);
  
  return stats;
};

/**
 * 检查是否需要清理存储
 */
export const shouldCleanupStorage = () => {
  const stats = getStorageUsage();
  return {
    needsWarning: stats.totalSizeMB > STORAGE_LIMITS.WARNING_STORAGE_SIZE_MB,
    needsCleanup: stats.totalSizeMB > STORAGE_LIMITS.MAX_STORAGE_SIZE_MB,
    stats
  };
};

/**
 * 清理过期数据
 */
export const cleanupExpiredData = () => {
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - STORAGE_LIMITS.MAX_STORAGE_AGE_DAYS * 24 * 60 * 60 * 1000);
  
  const keysToClean = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    
    if (key && key.startsWith('ainovel_chapter_')) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        const timestamp = data.lastInteractionTime || data.lastModified;
        
        if (timestamp && new Date(timestamp) < cutoffDate) {
          keysToClean.push({
            key,
            timestamp,
            size: new Blob([localStorage.getItem(key)]).size
          });
        }
      } catch (error) {
        // 如果数据损坏，也标记为需要清理
        keysToClean.push({
          key,
          timestamp: null,
          size: 0,
          corrupted: true
        });
      }
    }
  }
  
  // 按时间排序，优先清理最旧的数据
  keysToClean.sort((a, b) => {
    if (a.corrupted && !b.corrupted) return -1;
    if (!a.corrupted && b.corrupted) return 1;
    if (!a.timestamp || !b.timestamp) return 0;
    return new Date(a.timestamp) - new Date(b.timestamp);
  });
  
  let cleanedSize = 0;
  const cleanedKeys = [];
  
  keysToClean.forEach(item => {
    try {
      localStorage.removeItem(item.key);
      cleanedSize += item.size;
      cleanedKeys.push(item.key);
    } catch (error) {
      console.warn(`Failed to remove key "${item.key}":`, error);
    }
  });
  
  return {
    cleanedCount: cleanedKeys.length,
    cleanedSize,
    cleanedSizeMB: cleanedSize / (1024 * 1024),
    cleanedKeys
  };
};

/**
 * 压缩聊天记录
 */
export const compressChatHistory = () => {
  let processedCount = 0;
  let compressedSize = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    
    if (key && key.includes('_chapter_') && key.endsWith('_ai_chat')) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        
        if (data.messages && data.messages.length > STORAGE_LIMITS.MAX_CHAT_MESSAGES_PER_CHAPTER) {
          const originalSize = new Blob([localStorage.getItem(key)]).size;
          
          // 保留第一条默认消息和最近的消息
          const firstMessage = data.messages[0];
          const recentMessages = data.messages.slice(-STORAGE_LIMITS.MAX_CHAT_MESSAGES_PER_CHAPTER + 1);
          
          const compressedData = {
            ...data,
            messages: [firstMessage, ...recentMessages],
            compressed: true,
            compressedAt: new Date().toISOString(),
            originalMessageCount: data.messages.length
          };
          
          localStorage.setItem(key, JSON.stringify(compressedData));
          
          const newSize = new Blob([localStorage.getItem(key)]).size;
          compressedSize += (originalSize - newSize);
          processedCount++;
        }
      } catch (error) {
        console.warn(`Failed to compress chat history for key "${key}":`, error);
      }
    }
  }
  
  return {
    processedCount,
    compressedSize,
    compressedSizeMB: compressedSize / (1024 * 1024)
  };
};

/**
 * 智能存储清理
 * 根据使用频率和重要性智能清理数据
 */
export const smartCleanup = () => {
  const results = {
    expired: null,
    compressed: null,
    forceCleaned: null,
    finalStats: null
  };
  
  // 第一步：清理过期数据
  results.expired = cleanupExpiredData();
  
  // 第二步：压缩聊天记录
  results.compressed = compressChatHistory();
  
  // 第三步：检查是否还需要强制清理
  const storageCheck = shouldCleanupStorage();
  
  if (storageCheck.needsCleanup) {
    results.forceCleaned = forceCleanupOldest();
  }
  
  // 最终统计
  results.finalStats = getStorageUsage();
  
  return results;
};

/**
 * 强制清理最旧的数据
 */
export const forceCleanupOldest = () => {
  const dataItems = [];
  
  // 收集所有章节数据并按时间排序
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    
    if (key && key.startsWith('ainovel_chapter_')) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        const timestamp = data.lastInteractionTime || data.lastModified;
        const size = new Blob([localStorage.getItem(key)]).size;
        
        if (timestamp) {
          dataItems.push({
            key,
            timestamp: new Date(timestamp),
            size
          });
        }
      } catch (error) {
        // 损坏的数据优先清理
        dataItems.push({
          key,
          timestamp: new Date(0), // 设为最早时间
          size: 0,
          corrupted: true
        });
      }
    }
  }
  
  // 按时间排序，最旧的在前
  dataItems.sort((a, b) => a.timestamp - b.timestamp);
  
  let cleanedSize = 0;
  const cleanedKeys = [];
  const targetCleanupCount = Math.min(STORAGE_LIMITS.CLEANUP_BATCH_SIZE, Math.floor(dataItems.length * 0.2));
  
  for (let i = 0; i < targetCleanupCount && i < dataItems.length; i++) {
    try {
      localStorage.removeItem(dataItems[i].key);
      cleanedSize += dataItems[i].size;
      cleanedKeys.push(dataItems[i].key);
    } catch (error) {
      console.warn(`Failed to remove key "${dataItems[i].key}":`, error);
    }
  }
  
  return {
    cleanedCount: cleanedKeys.length,
    cleanedSize,
    cleanedSizeMB: cleanedSize / (1024 * 1024),
    cleanedKeys
  };
};

/**
 * 处理存储配额超出错误
 */
export const handleQuotaExceeded = () => {
  console.warn('Storage quota exceeded, performing emergency cleanup...');
  
  const emergencyResults = {
    beforeStats: getStorageUsage(),
    cleanupResults: null,
    afterStats: null,
    success: false
  };
  
  try {
    // 执行紧急清理
    emergencyResults.cleanupResults = smartCleanup();
    emergencyResults.afterStats = getStorageUsage();
    emergencyResults.success = true;
    
    return emergencyResults;
  } catch (error) {
    console.error('Emergency cleanup failed:', error);
    emergencyResults.error = error.message;
    return emergencyResults;
  }
};

/**
 * 获取存储健康状态
 */
export const getStorageHealthStatus = () => {
  const stats = getStorageUsage();
  const check = shouldCleanupStorage();
  
  let status = 'healthy';
  let recommendation = '存储空间充足';
  
  if (check.needsCleanup) {
    status = 'critical';
    recommendation = '建议立即清理存储空间';
  } else if (check.needsWarning) {
    status = 'warning';
    recommendation = '建议清理部分数据以释放空间';
  }
  
  return {
    status,
    recommendation,
    stats,
    usage: {
      percentage: (stats.totalSizeMB / STORAGE_LIMITS.MAX_STORAGE_SIZE_MB) * 100,
      totalMB: stats.totalSizeMB,
      limitMB: STORAGE_LIMITS.MAX_STORAGE_SIZE_MB
    }
  };
};

/**
 * 导出存储数据（用于备份）
 */
export const exportStorageData = () => {
  const exportData = {
    timestamp: new Date().toISOString(),
    version: '1.0',
    data: {}
  };
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('ainovel_')) {
      try {
        exportData.data[key] = JSON.parse(localStorage.getItem(key));
      } catch (error) {
        console.warn(`Failed to export key "${key}":`, error);
      }
    }
  }
  
  return exportData;
};

/**
 * 导入存储数据（用于恢复）
 */
export const importStorageData = (exportData) => {
  if (!exportData || !exportData.data) {
    throw new Error('Invalid export data format');
  }
  
  const results = {
    imported: 0,
    failed: 0,
    errors: []
  };
  
  Object.entries(exportData.data).forEach(([key, value]) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      results.imported++;
    } catch (error) {
      results.failed++;
      results.errors.push({ key, error: error.message });
    }
  });
  
  return results;
};

// 默认导出主要功能
export default {
  getStorageUsage,
  shouldCleanupStorage,
  cleanupExpiredData,
  compressChatHistory,
  smartCleanup,
  handleQuotaExceeded,
  getStorageHealthStatus,
  exportStorageData,
  importStorageData,
  STORAGE_LIMITS
};