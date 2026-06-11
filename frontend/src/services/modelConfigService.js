import { api } from './core/apiClient.js';

class ModelConfigService {
  // 获取所有模型配置
  getModelConfigs() {
    return api.get('/model-configs/');
  }

  // 获取单个模型配置
  getModelConfig(id) {
    return api.get(`/model-configs/${id}`);
  }

  // 创建模型配置
  createModelConfig(configData) {
    return api.post('/model-configs/', configData);
  }

  // 更新模型配置
  updateModelConfig(id, configData) {
    return api.put(`/model-configs/${id}`, configData);
  }

  // 删除模型配置
  deleteModelConfig(id) {
    return api.delete(`/model-configs/${id}`);
  }

  // 测试连接
  testConnection(testData) {
    return api.post('/model-configs/test-connection', testData);
  }

  // 测试已保存的连接
  testExistingConnection(configId) {
    return api.post(`/model-configs/${configId}/test`);
  }

  // 获取模型类型列表（纯前端数据）
  getModelTypes() {
    return [
      { value: 'openai', label: 'OpenAI' },
      { value: 'claude', label: 'Claude' },
      { value: 'gemini', label: 'Gemini' },
      { value: 'custom', label: '自定义' },
    ];
  }

  // 从后端获取可用模型列表
  listAvailableModels(apiKey, modelType, proxyUrl) {
    return api.post('/model-configs/list-models', {
      api_key: apiKey, model_type: modelType, proxy_url: proxyUrl,
    });
  }

  // 使用已保存的配置获取模型列表
  listAvailableModelsById(configId) {
    return api.post(`/model-configs/${configId}/list-models`);
  }

  // 验证模型配置（纯前端校验）
  validateConfig(config) {
    const errors = [];
    if (!config.name || config.name.trim() === '') errors.push('配置名称不能为空');
    if (!config.model_type) errors.push('模型类型不能为空');
    if (!config.api_key || config.api_key.trim() === '') {
      if (!config.api_key_masked) errors.push('API密钥不能为空');
    }
    if (config.temperature && (config.temperature < 0 || config.temperature > 2))
      errors.push('温度值必须在0-2之间');
    if (config.max_tokens && config.max_tokens < 1)
      errors.push('最大令牌数必须大于0');
    if (config.top_p && (config.top_p < 0 || config.top_p > 1))
      errors.push('Top P值必须在0-1之间');
    if (config.top_k && (config.top_k < 0 || config.top_k > 100))
      errors.push('Top K值必须在0-100之间');
    if (config.frequency_penalty && (config.frequency_penalty < -2 || config.frequency_penalty > 2))
      errors.push('频率惩罚值必须在-2到2之间');
    if (config.presence_penalty && (config.presence_penalty < -2 || config.presence_penalty > 2))
      errors.push('存在惩罚值必须在-2到2之间');
    if (config.top_logprobs && (config.top_logprobs < 0 || config.top_logprobs > 20))
      errors.push('Top Logprobs值必须在0-20之间');
    if (config.enable_proxy && (!config.proxy_url || config.proxy_url.trim() === ''))
      errors.push('启用代理时必须填写代理URL');
    return errors;
  }

  // 获取默认配置（纯前端数据）
  getDefaultConfig() {
    return {
      name: '',
      model_type: 'openai',
      model_name: 'gpt-3.5-turbo',
      api_key: '',
      api_url: '',
      temperature: 0.7,
      max_tokens: 2000,
      top_p: 1.0,
      top_k: 40,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
      stop_sequences: [],
      stream: false,
      logprobs: false,
      top_logprobs: 0,
      proxy_url: '',
      enable_proxy: false,
    };
  }
}

export const modelConfigService = new ModelConfigService();
export default modelConfigService;
