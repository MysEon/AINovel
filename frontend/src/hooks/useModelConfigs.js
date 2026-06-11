import { useState } from 'react';
import { aiService, getAvailableModelConfigs } from '../services/aiService';

const useModelConfigs = ({ addNotification, configLoaded, globalSelectedConfigId, setGlobalSelectedConfigId }) => {
  const [modelConfigs, setModelConfigs] = useState([]);
  const [selectedModelConfig, setSelectedModelConfig] = useState(null);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);

  const handleModelConfigChange = (configId) => {
    const config = modelConfigs.find(c => c.id === configId);
    if (config) {
      setSelectedModelConfig(config);
      aiService.setSelectedModelConfigId(configId);

      // 使用全局持久化
      setGlobalSelectedConfigId(configId);

      addNotification({
        message: `已切换到 ${config.name} 模型`,
        type: 'success',
        duration: 2000
      });
    }
  };

  const fetchModelConfigs = async () => {
    setIsLoadingConfigs(true);
    try {
      const configs = await getAvailableModelConfigs();
      setModelConfigs(configs);

      // 如果有配置，优先使用全局持久化的配置
      if (configs.length > 0 && configLoaded) {
        let configToSelect = null;

        if (globalSelectedConfigId) {
          configToSelect = configs.find(c => c.id === globalSelectedConfigId);
        }

        if (!configToSelect) {
          configToSelect = configs[0];
        }

        if (configToSelect) {
          setSelectedModelConfig(configToSelect);
          aiService.setSelectedModelConfigId(configToSelect.id);

          // 如果全局没有保存这个配置，则保存它
          if (globalSelectedConfigId !== configToSelect.id) {
            setGlobalSelectedConfigId(configToSelect.id);
          }
        }
      }
    } catch (error) {
      console.error('WritingEditor: Error fetching model configs:', error);
      // 只在非401错误时显示通知
      if (error.message && !error.message.includes('401')) {
        addNotification({
          message: '获取AI模型配置失败: ' + error.message,
          type: 'error',
          duration: 3000
        });
      }
    } finally {
      setIsLoadingConfigs(false);
    }
  };

  return {
    modelConfigs,
    selectedModelConfig,
    isLoadingConfigs,
    fetchModelConfigs,
    handleModelConfigChange
  };
};

export default useModelConfigs;
