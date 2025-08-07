/**
 * Unit tests for modelConfigService
 */

import modelConfigService from '../../services/modelConfigService';

// Mock fetch
global.fetch = jest.fn();

describe('modelConfigService', () => {
  const mockToken = 'test-token-123';
  const mockConfigs = [
    {
      id: 1,
      name: 'Test Config',
      model_type: 'openai',
      model_name: 'gpt-3.5-turbo',
      temperature: 0.7,
      max_tokens: 2000,
      user_id: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    // Setup localStorage mock
    localStorage.setItem('ainovel_token', mockToken);
    
    // Reset fetch mock
    fetch.mockClear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('request method', () => {
    test('makes request with correct headers', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: 'test' }),
      };
      fetch.mockResolvedValue(mockResponse);

      await modelConfigService.request('/test');

      expect(fetch).toHaveBeenCalledWith(
        '/api/model-configs/test',
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockToken}`,
          },
        }
      );
    });

    test('handles successful response', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true }),
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await modelConfigService.request('/test');

      expect(result).toEqual({ success: true });
    });

    test('handles HTTP error response', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValue({ detail: 'Not found' }),
      };
      fetch.mockResolvedValue(mockResponse);

      await expect(modelConfigService.request('/test')).rejects.toThrow('Not found');
    });

    test('handles HTTP error response with message', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ message: 'Bad request' }),
      };
      fetch.mockResolvedValue(mockResponse);

      await expect(modelConfigService.request('/test')).rejects.toThrow('Bad request');
    });

    test('handles network error', async () => {
      fetch.mockRejectedValue(new Error('Network error'));

      await expect(modelConfigService.request('/test')).rejects.toThrow('Network error');
    });

    test('handles JSON parsing error', async () => {
      const mockResponse = {
        ok: false,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      };
      fetch.mockResolvedValue(mockResponse);

      await expect(modelConfigService.request('/test')).rejects.toThrow('请求失败');
    });
  });

  describe('getModelConfigs', () => {
    test('fetches all model configs', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockConfigs),
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await modelConfigService.getModelConfigs();

      expect(fetch).toHaveBeenCalledWith('/api/model-configs/', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
      });
      expect(result).toEqual(mockConfigs);
    });
  });

  describe('getModelConfig', () => {
    test('fetches single model config', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockConfigs[0]),
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await modelConfigService.getModelConfig(1);

      expect(fetch).toHaveBeenCalledWith('/api/model-configs/1', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
      });
      expect(result).toEqual(mockConfigs[0]);
    });
  });

  describe('createModelConfig', () => {
    test('creates new model config', async () => {
      const newConfig = {
        name: 'New Config',
        model_type: 'openai',
        api_key: 'test-key',
      };
      const createdConfig = { ...newConfig, id: 1 };
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(createdConfig),
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await modelConfigService.createModelConfig(newConfig);

      expect(fetch).toHaveBeenCalledWith('/api/model-configs/', {
        method: 'POST',
        body: JSON.stringify(newConfig),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
      });
      expect(result).toEqual(createdConfig);
    });
  });

  describe('updateModelConfig', () => {
    test('updates existing model config', async () => {
      const updateData = {
        name: 'Updated Config',
        temperature: 0.8,
      };
      const updatedConfig = { ...mockConfigs[0], ...updateData };
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(updatedConfig),
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await modelConfigService.updateModelConfig(1, updateData);

      expect(fetch).toHaveBeenCalledWith('/api/model-configs/1', {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
      });
      expect(result).toEqual(updatedConfig);
    });
  });

  describe('deleteModelConfig', () => {
    test('deletes model config', async () => {
      const deleteResponse = {
        message: 'Model config deleted successfully',
      };
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(deleteResponse),
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await modelConfigService.deleteModelConfig(1);

      expect(fetch).toHaveBeenCalledWith('/api/model-configs/1', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
      });
      expect(result).toEqual(deleteResponse);
    });
  });

  describe('testConnection', () => {
    test('tests model connection', async () => {
      const testData = {
        api_key: 'test-key',
        model_type: 'openai',
        model_name: 'gpt-3.5-turbo',
      };
      const testResult = {
        success: true,
        message: 'Connection successful',
      };
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(testResult),
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await modelConfigService.testConnection(testData);

      expect(fetch).toHaveBeenCalledWith('/api/model-configs/test-connection', {
        method: 'POST',
        body: JSON.stringify(testData),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
      });
      expect(result).toEqual(testResult);
    });
  });

  describe('getModelTypes', () => {
    test('returns available model types', () => {
      const modelTypes = modelConfigService.getModelTypes();

      expect(modelTypes).toEqual([
        { value: 'openai', label: 'OpenAI' },
        { value: 'claude', label: 'Claude' },
        { value: 'custom', label: 'Custom' },
      ]);
    });
  });

  describe('getOpenAIModels', () => {
    test('returns OpenAI models', () => {
      const models = modelConfigService.getOpenAIModels();

      expect(models).toEqual([
        { value: 'gpt-4', label: 'GPT-4' },
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
      ]);
    });
  });

  describe('getClaudeModels', () => {
    test('returns Claude models', () => {
      const models = modelConfigService.getClaudeModels();

      expect(models).toEqual([
        { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
        { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
        { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
        { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
        { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
      ]);
    });
  });

  describe('validateConfig', () => {
    test('returns empty array for valid config', () => {
      const validConfig = {
        name: 'Test Config',
        model_type: 'openai',
        api_key: 'test-key',
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 1.0,
        top_k: 40,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        top_logprobs: 0,
      };

      const errors = modelConfigService.validateConfig(validConfig);

      expect(errors).toEqual([]);
    });

    test('validates required fields', () => {
      const invalidConfig = {
        name: '',
        model_type: '',
        api_key: '',
      };

      const errors = modelConfigService.validateConfig(invalidConfig);

      expect(errors).toContain('配置名称不能为空');
      expect(errors).toContain('模型类型不能为空');
      expect(errors).toContain('API密钥不能为空');
    });

    test('validates temperature range', () => {
      const invalidConfig = {
        name: 'Test Config',
        model_type: 'openai',
        api_key: 'test-key',
        temperature: 3.0, // Too high
      };

      const errors = modelConfigService.validateConfig(invalidConfig);

      expect(errors).toContain('温度值必须在0-2之间');
    });

    test('validates max_tokens range', () => {
      const invalidConfig = {
        name: 'Test Config',
        model_type: 'openai',
        api_key: 'test-key',
        max_tokens: -1, // Negative
      };

      const errors = modelConfigService.validateConfig(invalidConfig);

      expect(errors).toContain('最大令牌数必须在1-32000之间');
    });

    test('validates top_p range', () => {
      const invalidConfig = {
        name: 'Test Config',
        model_type: 'openai',
        api_key: 'test-key',
        top_p: 2.0, // Too high
      };

      const errors = modelConfigService.validateConfig(invalidConfig);

      expect(errors).toContain('Top P值必须在0-1之间');
    });

    test('validates top_k range', () => {
      const invalidConfig = {
        name: 'Test Config',
        model_type: 'openai',
        api_key: 'test-key',
        top_k: -1, // Negative
      };

      const errors = modelConfigService.validateConfig(invalidConfig);

      expect(errors).toContain('Top K值必须在0-100之间');
    });

    test('validates frequency_penalty range', () => {
      const invalidConfig = {
        name: 'Test Config',
        model_type: 'openai',
        api_key: 'test-key',
        frequency_penalty: 3.0, // Too high
      };

      const errors = modelConfigService.validateConfig(invalidConfig);

      expect(errors).toContain('频率惩罚值必须在-2到2之间');
    });

    test('validates presence_penalty range', () => {
      const invalidConfig = {
        name: 'Test Config',
        model_type: 'openai',
        api_key: 'test-key',
        presence_penalty: -3.0, // Too low
      };

      const errors = modelConfigService.validateConfig(invalidConfig);

      expect(errors).toContain('存在惩罚值必须在-2到2之间');
    });

    test('validates top_logprobs range', () => {
      const invalidConfig = {
        name: 'Test Config',
        model_type: 'openai',
        api_key: 'test-key',
        top_logprobs: 25, // Too high
      };

      const errors = modelConfigService.validateConfig(invalidConfig);

      expect(errors).toContain('Top Logprobs值必须在0-20之间');
    });

    test('allows optional fields to be undefined', () => {
      const validConfig = {
        name: 'Test Config',
        model_type: 'openai',
        api_key: 'test-key',
        // Optional fields omitted
      };

      const errors = modelConfigService.validateConfig(validConfig);

      expect(errors).toEqual([]);
    });

    test('handles multiple validation errors', () => {
      const invalidConfig = {
        name: '',
        model_type: '',
        api_key: '',
        temperature: 3.0,
        max_tokens: -1,
        top_p: 2.0,
        top_k: -1,
        frequency_penalty: 3.0,
        presence_penalty: -3.0,
        top_logprobs: 25,
      };

      const errors = modelConfigService.validateConfig(invalidConfig);

      expect(errors).toContain('配置名称不能为空');
      expect(errors).toContain('模型类型不能为空');
      expect(errors).toContain('API密钥不能为空');
      expect(errors).toContain('温度值必须在0-2之间');
      expect(errors).toContain('最大令牌数必须在1-32000之间');
      expect(errors).toContain('Top P值必须在0-1之间');
      expect(errors).toContain('Top K值必须在0-100之间');
      expect(errors).toContain('频率惩罚值必须在-2到2之间');
      expect(errors).toContain('存在惩罚值必须在-2到2之间');
      expect(errors).toContain('Top Logprobs值必须在0-20之间');
    });
  });

  describe('getDefaultConfig', () => {
    test('returns default configuration', () => {
      const defaultConfig = modelConfigService.getDefaultConfig();

      expect(defaultConfig).toEqual({
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
      });
    });
  });

  describe('authentication', () => {
    test('handles missing token', () => {
      localStorage.removeItem('ainovel_token');

      const expectedHeaders = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer null',
      };

      modelConfigService.request('/test');

      expect(fetch).toHaveBeenCalledWith(
        '/api/model-configs/test',
        {
          headers: expectedHeaders,
        }
      );
    });
  });

  describe('error handling', () => {
    test('handles empty error response', async () => {
      const mockResponse = {
        ok: false,
        json: jest.fn().mockRejectedValue(new Error('Parse error')),
      };
      fetch.mockResolvedValue(mockResponse);

      await expect(modelConfigService.request('/test')).rejects.toThrow('请求失败');
    });

    test('handles error response without detail or message', async () => {
      const mockResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({}),
      };
      fetch.mockResolvedValue(mockResponse);

      await expect(modelConfigService.request('/test')).rejects.toThrow('请求失败');
    });
  });
});