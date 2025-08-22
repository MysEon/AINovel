import { useState, useEffect, useCallback } from 'react';

// AI模型配置持久化的存储key
const AI_MODEL_CONFIG_STORAGE_KEY = 'ainovel_selected_model_config';

/**
 * AI模型配置持久化hook
 * 用于在整个应用中持久化和共享选中的AI模型配置
 */
export const useAIModelConfig = () => {
  const [selectedModelConfigId, setSelectedModelConfigId] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // 从localStorage加载保存的模型配置ID
  const loadSelectedModelConfig = useCallback(() => {
    try {
      const savedConfigId = localStorage.getItem(AI_MODEL_CONFIG_STORAGE_KEY);
      if (savedConfigId) {
        const configId = parseInt(savedConfigId, 10);
        if (!isNaN(configId)) {
          setSelectedModelConfigId(configId);
        }
      }
    } catch (error) {
      console.warn('加载AI模型配置失败:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // 保存选中的模型配置ID到localStorage
  const saveSelectedModelConfig = useCallback((configId) => {
    try {
      if (configId && typeof configId === 'number') {
        localStorage.setItem(AI_MODEL_CONFIG_STORAGE_KEY, configId.toString());
        setSelectedModelConfigId(configId);
      } else if (configId === null || configId === undefined) {
        localStorage.removeItem(AI_MODEL_CONFIG_STORAGE_KEY);
        setSelectedModelConfigId(null);
      }
    } catch (error) {
      console.error('保存AI模型配置失败:', error);
    }
  }, []);

  // 清除保存的模型配置
  const clearSelectedModelConfig = useCallback(() => {
    try {
      localStorage.removeItem(AI_MODEL_CONFIG_STORAGE_KEY);
      setSelectedModelConfigId(null);
    } catch (error) {
      console.error('清除AI模型配置失败:', error);
    }
  }, []);

  // 组件挂载时加载保存的配置
  useEffect(() => {
    loadSelectedModelConfig();
  }, [loadSelectedModelConfig]);

  return {
    selectedModelConfigId,
    setSelectedModelConfigId: saveSelectedModelConfig,
    clearSelectedModelConfig,
    isLoaded, // 用于判断是否已经从localStorage加载完成
  };
};

export default useAIModelConfig;