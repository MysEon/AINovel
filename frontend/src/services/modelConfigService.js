const API_BASE_URL = '/api';

// 获取认证头
const getAuthHeaders = () => {
  const token = localStorage.getItem('ainovel_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

class ModelConfigService {
  constructor() {
    this.baseURL = `${API_BASE_URL}/model-configs`;
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || '请求失败');
    }

    return response.json();
  }

  // 获取所有模型配置
  async getModelConfigs() {
    return this.request('/');
  }

  // 获取单个模型配置
  async getModelConfig(id) {
    return this.request(`/${id}`);
  }

  // 创建模型配置
  async createModelConfig(configData) {
    return this.request('/', {
      method: 'POST',
      body: JSON.stringify(configData),
    });
  }

  // 更新模型配置
  async updateModelConfig(id, configData) {
    return this.request(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(configData),
    });
  }

  // 删除模型配置
  async deleteModelConfig(id) {
    return this.request(`/${id}`, {
      method: 'DELETE',
    });
  }

  // 测试连接
  async testConnection(testData) {
    return this.request('/test-connection', {
      method: 'POST',
      body: JSON.stringify(testData),
    });
  }

  // 获取模型类型列表
  getModelTypes() {
    return [
      { value: 'openai', label: 'OpenAI' },
      { value: 'claude', label: 'Claude' },
      { value: 'custom', label: '自定义' },
    ];
  }

  // 获取OpenAI模型列表
  getOpenAIModels() {
    return [
      { value: 'gpt-4', label: 'GPT-4' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ];
  }

  // 获取Claude模型列表
  getClaudeModels() {
    return [
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
      { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
      { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
      { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
    ];
  }

  // 验证模型配置
  validateConfig(config) {
    const errors = [];

    if (!config.name || config.name.trim() === '') {
      errors.push('配置名称不能为空');
    }

    if (!config.model_type) {
      errors.push('模型类型不能为空');
    }

    if (!config.api_key || config.api_key.trim() === '') {
      errors.push('API密钥不能为空');
    }

    if (config.temperature && (config.temperature < 0 || config.temperature > 2)) {
      errors.push('温度值必须在0-2之间');
    }

    if (config.max_tokens && (config.max_tokens < 1 || config.max_tokens > 32000)) {
      errors.push('最大令牌数必须在1-32000之间');
    }

    if (config.top_p && (config.top_p < 0 || config.top_p > 1)) {
      errors.push('Top P值必须在0-1之间');
    }

    if (config.top_k && (config.top_k < 0 || config.top_k > 100)) {
      errors.push('Top K值必须在0-100之间');
    }

    if (config.frequency_penalty && (config.frequency_penalty < -2 || config.frequency_penalty > 2)) {
      errors.push('频率惩罚值必须在-2到2之间');
    }

    if (config.presence_penalty && (config.presence_penalty < -2 || config.presence_penalty > 2)) {
      errors.push('存在惩罚值必须在-2到2之间');
    }

    if (config.top_logprobs && (config.top_logprobs < 0 || config.top_logprobs > 20)) {
      errors.push('Top Logprobs值必须在0-20之间');
    }

    return errors;
  }

  // 获取默认配置
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
    };
  }
}

export const modelConfigService = new ModelConfigService();
export default modelConfigService;