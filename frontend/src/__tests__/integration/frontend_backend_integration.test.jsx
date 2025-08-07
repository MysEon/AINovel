/**
 * Integration tests for frontend-backend communication
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ModelConfigManager from '../components/ModelConfigManager';
import modelConfigService from '../services/modelConfigService';

// Mock the service
jest.mock('../services/modelConfigService');
const mockModelConfigService = modelConfigService;

// Mock Notification component
jest.mock('../components/Notification', () => {
  return jest.fn(({ message, type, onClose }) => (
    <div data-testid="notification" data-type={type}>
      {message}
      <button onClick={onClose}>Close</button>
    </div>
  ));
});

describe('Frontend-Backend Integration', () => {
  const mockConfigs = [
    {
      id: 1,
      name: 'Integration Test Config',
      model_type: 'openai',
      model_name: 'gpt-3.5-turbo',
      temperature: 0.7,
      max_tokens: 2000,
      user_id: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  const defaultConfig = {
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

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockModelConfigService.getModelConfigs.mockResolvedValue(mockConfigs);
    mockModelConfigService.createModelConfig.mockResolvedValue({
      id: 2,
      ...defaultConfig,
      name: 'New Integration Config',
    });
    mockModelConfigService.updateModelConfig.mockResolvedValue({
      id: 1,
      ...defaultConfig,
      name: 'Updated Integration Config',
    });
    mockModelConfigService.deleteModelConfig.mockResolvedValue({
      message: 'Model config deleted successfully',
    });
    mockModelConfigService.testConnection.mockResolvedValue({
      success: true,
      message: 'Connection test successful',
    });
    mockModelConfigService.getDefaultConfig.mockReturnValue(defaultConfig);
    mockModelConfigService.getModelTypes.mockReturnValue([
      { value: 'openai', label: 'OpenAI' },
      { value: 'claude', label: 'Claude' },
    ]);
    mockModelConfigService.getOpenAIModels.mockReturnValue([
      { value: 'gpt-4', label: 'GPT-4' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ]);
    mockModelConfigService.getClaudeModels.mockReturnValue([
      { value: 'claude-3-sonnet-20240229', label: 'Claude 3.5 Sonnet' },
    ]);
    mockModelConfigService.validateConfig.mockReturnValue([]);
  });

  describe('Complete CRUD Workflow Integration', () => {
    test('performs full CRUD operations successfully', async () => {
      render(<ModelConfigManager />);

      // 1. Load initial configs
      await waitFor(() => {
        expect(screen.queryByText('加载配置...')).not.toBeInTheDocument();
      });

      // Verify initial load
      expect(mockModelConfigService.getModelConfigs).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Integration Test Config')).toBeInTheDocument();

      // 2. Create new config
      fireEvent.click(screen.getByText('新建配置'));

      // Fill form
      fireEvent.change(screen.getByLabelText('配置名称 *'), {
        target: { value: 'New Integration Config' },
      });
      fireEvent.change(screen.getByLabelText('API密钥 *'), {
        target: { value: 'integration-test-key' },
      });

      // Submit
      fireEvent.click(screen.getByText('保存'));

      // Verify create call
      expect(mockModelConfigService.createModelConfig).toHaveBeenCalledWith({
        ...defaultConfig,
        name: 'New Integration Config',
        api_key: 'integration-test-key',
      });

      // Wait for success notification
      await waitFor(() => {
        const notification = screen.getByTestId('notification');
        expect(notification).toHaveAttribute('data-type', 'success');
        expect(notification).toHaveTextContent('配置创建成功');
      });

      // 3. Verify reload after create
      expect(mockModelConfigService.getModelConfigs).toHaveBeenCalledTimes(2);

      // 4. Edit existing config
      const editButtons = screen.getAllByTitle('编辑');
      fireEvent.click(editButtons[0]);

      // Update form
      fireEvent.change(screen.getByLabelText('配置名称 *'), {
        target: { value: 'Updated Integration Config' },
      });
      fireEvent.change(screen.getByLabelText('温度 (0-2)'), {
        target: { value: '0.8' },
      });

      // Submit
      fireEvent.click(screen.getByText('保存'));

      // Verify update call
      expect(mockModelConfigService.updateModelConfig).toHaveBeenCalledWith(1, {
        ...defaultConfig,
        name: 'Updated Integration Config',
        temperature: 0.8,
      });

      // Wait for success notification
      await waitFor(() => {
        const notification = screen.getByTestId('notification');
        expect(notification).toHaveAttribute('data-type', 'success');
        expect(notification).toHaveTextContent('配置更新成功');
      });

      // 5. Test connection
      fireEvent.click(screen.getByText('测试连接'));

      // Verify test connection call
      expect(mockModelConfigService.testConnection).toHaveBeenCalledWith({
        api_key: 'integration-test-key',
        api_url: '',
        model_type: 'openai',
        model_name: 'gpt-3.5-turbo',
      });

      // Wait for success notification
      await waitFor(() => {
        const notification = screen.getByTestId('notification');
        expect(notification).toHaveAttribute('data-type', 'success');
        expect(notification).toHaveTextContent('连接测试成功!');
      });

      // 6. Delete config
      window.confirm = jest.fn(() => true);
      const deleteButtons = screen.getAllByTitle('删除');
      fireEvent.click(deleteButtons[0]);

      // Verify delete call
      expect(mockModelConfigService.deleteModelConfig).toHaveBeenCalledWith(1);

      // Wait for success notification
      await waitFor(() => {
        const notification = screen.getByTestId('notification');
        expect(notification).toHaveAttribute('data-type', 'success');
        expect(notification).toHaveTextContent('配置删除成功');
      });

      // 7. Verify reload after delete
      expect(mockModelConfigService.getModelConfigs).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Handling Integration', () => {
    test('handles API errors gracefully throughout workflow', async () => {
      // Mock API error
      mockModelConfigService.getModelConfigs.mockRejectedValue(
        new Error('API Server Error')
      );

      render(<ModelConfigManager />);

      // Verify error handling
      await waitFor(() => {
        const notification = screen.getByTestId('notification');
        expect(notification).toHaveAttribute('data-type', 'error');
        expect(notification).toHaveTextContent('加载配置失败: API Server Error');
      });

      // Reset mock for subsequent operations
      mockModelConfigService.getModelConfigs.mockResolvedValue([]);

      // 1. Test create error
      mockModelConfigService.createModelConfig.mockRejectedValue(
        new Error('Create failed')
      );

      fireEvent.click(screen.getByText('新建配置'));
      fireEvent.change(screen.getByLabelText('配置名称 *'), {
        target: { value: 'Error Test Config' },
      });
      fireEvent.change(screen.getByLabelText('API密钥 *'), {
        target: { value: 'test-key' },
      });
      fireEvent.click(screen.getByText('保存'));

      await waitFor(() => {
        const notification = screen.getByTestId('notification');
        expect(notification).toHaveAttribute('data-type', 'error');
        expect(notification).toHaveTextContent('保存失败: Create failed');
      });

      // 2. Test update error
      mockModelConfigService.getModelConfigs.mockResolvedValue(mockConfigs);
      mockModelConfigService.updateModelConfig.mockRejectedValue(
        new Error('Update failed')
      );

      // Reload component
      render(<ModelConfigManager />);

      await waitFor(() => {
        expect(screen.queryByText('加载配置...')).not.toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('编辑');
      fireEvent.click(editButtons[0]);
      fireEvent.change(screen.getByLabelText('温度 (0-2)'), {
        target: { value: '0.8' },
      });
      fireEvent.click(screen.getByText('保存'));

      await waitFor(() => {
        const notification = screen.getByTestId('notification');
        expect(notification).toHaveAttribute('data-type', 'error');
        expect(notification).toHaveTextContent('保存失败: Update failed');
      });

      // 3. Test delete error
      mockModelConfigService.deleteModelConfig.mockRejectedValue(
        new Error('Delete failed')
      );

      window.confirm = jest.fn(() => true);
      const deleteButtons = screen.getAllByTitle('删除');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        const notification = screen.getByTestId('notification');
        expect(notification).toHaveAttribute('data-type', 'error');
        expect(notification).toHaveTextContent('删除失败: Delete failed');
      });

      // 4. Test connection error
      mockModelConfigService.testConnection.mockRejectedValue(
        new Error('Connection failed')
      );

      fireEvent.click(screen.getByText('测试连接'));

      await waitFor(() => {
        const notification = screen.getByTestId('notification');
        expect(notification).toHaveAttribute('data-type', 'error');
        expect(notification).toHaveTextContent('连接测试失败: Connection failed');
      });
    });

    test('handles network errors', async () => {
      // Mock network error
      mockModelConfigService.getModelConfigs.mockRejectedValue(
        new Error('Network Error')
      );

      render(<ModelConfigManager />);

      await waitFor(() => {
        const notification = screen.getByTestId('notification');
        expect(notification).toHaveAttribute('data-type', 'error');
        expect(notification).toHaveTextContent('加载配置失败: Network Error');
      });
    });

    test('handles validation errors from backend', async () => {
      // Mock validation error response
      mockModelConfigService.createModelConfig.mockRejectedValue(
        new Error('422: Validation Error')
      );

      render(<ModelConfigManager />);

      await waitFor(() => {
        expect(screen.queryByText('加载配置...')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('新建配置'));
      fireEvent.change(screen.getByLabelText('配置名称 *'), {
        target: { value: 'Invalid Config' },
      });
      fireEvent.change(screen.getByLabelText('API密钥 *'), {
        target: { value: 'test-key' },
      });
      fireEvent.click(screen.getByText('保存'));

      await waitFor(() => {
        const notification = screen.getByTestId('notification');
        expect(notification).toHaveAttribute('data-type', 'error');
        expect(notification).toHaveTextContent('保存失败: 422: Validation Error');
      });
    });
  });

  describe('Data Format Integration', () => {
    test('handles different data formats from backend', async () => {
      // Mock config with different data types
      const complexConfig = {
        id: 1,
        name: 'Complex Config',
        model_type: 'claude',
        model_name: 'claude-3-sonnet-20240229',
        temperature: 0.8,
        max_tokens: 4000,
        top_p: 0.9,
        top_k: 50,
        frequency_penalty: 0.1,
        presence_penalty: 0.2,
        stop_sequences: ['###', 'END', 'STOP'],
        stream: true,
        logprobs: true,
        top_logprobs: 5,
        api_url: 'https://api.anthropic.com/v1/messages',
        user_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockModelConfigService.getModelConfigs.mockResolvedValue([complexConfig]);

      render(<ModelConfigManager />);

      await waitFor(() => {
        expect(screen.queryByText('加载配置...')).not.toBeInTheDocument();
      });

      // Verify complex config is displayed correctly
      expect(screen.getByText('Complex Config')).toBeInTheDocument();
      expect(screen.getByText('claude')).toBeInTheDocument();
      expect(screen.getByText('claude-3-sonnet-20240229')).toBeInTheDocument();
      expect(screen.getByText('0.8')).toBeInTheDocument();
      expect(screen.getByText('4000')).toBeInTheDocument();

      // Test editing complex config
      const editButtons = screen.getAllByTitle('编辑');
      fireEvent.click(editButtons[0]);

      // Verify form is populated with complex data
      expect(screen.getByDisplayValue('Complex Config')).toBeInTheDocument();
      expect(screen.getByDisplayValue('claude-3-sonnet-20240229')).toBeInTheDocument();
      expect(screen.getByDisplayValue('0.8')).toBeInTheDocument();
      expect(screen.getByDisplayValue('4000')).toBeInTheDocument();
      expect(screen.getByDisplayValue('0.9')).toBeInTheDocument();
      expect(screen.getByDisplayValue('50')).toBeInTheDocument();
      expect(screen.getByDisplayValue('0.1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('0.2')).toBeInTheDocument();
      expect(screen.getByDisplayValue('5')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://api.anthropic.com/v1/messages')).toBeInTheDocument();

      // Verify checkboxes
      expect(screen.getByLabelText('流式输出')).toBeChecked();
      expect(screen.getByLabelText('对数概率')).toBeChecked();

      // Verify stop sequences
      expect(screen.getByLabelText('停止序列').value).toBe('###, END, STOP');
    });

    test('handles missing optional fields', async () => {
      // Mock config with missing optional fields
      const minimalConfig = {
        id: 1,
        name: 'Minimal Config',
        model_type: 'openai',
        api_key: 'test-key',
        user_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockModelConfigService.getModelConfigs.mockResolvedValue([minimalConfig]);

      render(<ModelConfigManager />);

      await waitFor(() => {
        expect(screen.queryByText('加载配置...')).not.toBeInTheDocument();
      });

      // Verify minimal config is displayed
      expect(screen.getByText('Minimal Config')).toBeInTheDocument();
      expect(screen.getByText('openai')).toBeInTheDocument();

      // Test editing minimal config
      const editButtons = screen.getAllByTitle('编辑');
      fireEvent.click(editButtons[0]);

      // Verify form is populated with defaults for missing fields
      expect(screen.getByDisplayValue('Minimal Config')).toBeInTheDocument();
      expect(screen.getByDisplayValue('gpt-3.5-turbo')).toBeInTheDocument(); // Default
      expect(screen.getByDisplayValue('0.7')).toBeInTheDocument(); // Default
      expect(screen.getByDisplayValue('2000')).toBeInTheDocument(); // Default
    });
  });

  describe('Authentication Integration', () => {
    test('handles authentication errors', async () => {
      // Mock authentication error
      mockModelConfigService.getModelConfigs.mockRejectedValue(
        new Error('401: Unauthorized')
      );

      render(<ModelConfigManager />);

      await waitFor(() => {
        const notification = screen.getByTestId('notification');
        expect(notification).toHaveAttribute('data-type', 'error');
        expect(notification).toHaveTextContent('加载配置失败: 401: Unauthorized');
      });
    });

    test('handles token expiration', async () => {
      // Mock token expiration error
      mockModelConfigService.getModelConfigs.mockRejectedValue(
        new Error('403: Token expired')
      );

      render(<ModelConfigManager />);

      await waitFor(() => {
        const notification = screen.getByTestId('notification');
        expect(notification).toHaveAttribute('data-type', 'error');
        expect(notification).toHaveTextContent('加载配置失败: 403: Token expired');
      });
    });
  });

  describe('Performance Integration', () => {
    test('handles slow API responses', async () => {
      // Mock slow response
      mockModelConfigService.getModelConfigs.mockImplementation(
        () => new Promise(resolve => {
          setTimeout(() => resolve(mockConfigs), 2000);
        })
      );

      render(<ModelConfigManager />);

      // Should show loading state
      expect(screen.getByText('加载配置...')).toBeInTheDocument();

      // Wait for completion
      await waitFor(() => {
        expect(screen.queryByText('加载配置...')).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify data is loaded
      expect(screen.getByText('Integration Test Config')).toBeInTheDocument();
    });

    test('handles concurrent requests', async () => {
      let resolveCreate;
      const createPromise = new Promise(resolve => {
        resolveCreate = resolve;
      });

      mockModelConfigService.createModelConfig.mockReturnValue(createPromise);

      render(<ModelConfigManager />);

      await waitFor(() => {
        expect(screen.queryByText('加载配置...')).not.toBeInTheDocument();
      });

      // Start create operation
      fireEvent.click(screen.getByText('新建配置'));
      fireEvent.change(screen.getByLabelText('配置名称 *'), {
        target: { value: 'Concurrent Config' },
      });
      fireEvent.change(screen.getByLabelText('API密钥 *'), {
        target: { value: 'test-key' },
      });
      fireEvent.click(screen.getByText('保存'));

      // Should show loading state
      expect(screen.getByText('保存')).toBeDisabled();

      // Resolve the promise
      resolveCreate({
        id: 2,
        ...defaultConfig,
        name: 'Concurrent Config',
      });

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText('保存')).not.toBeDisabled();
      });

      // Verify success
      const notification = screen.getByTestId('notification');
      expect(notification).toHaveAttribute('data-type', 'success');
      expect(notification).toHaveTextContent('配置创建成功');
    });
  });
});