import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaFlask, FaCheck, FaSpinner } from 'react-icons/fa';
import modelConfigService from '../services/modelConfigService';
import Notification from './Notification';
import './ModelConfigManager.css';

const ModelConfigManager = () => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingConfig, setEditingConfig] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [notification, setNotification] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);

  // 表单状态
  const [formData, setFormData] = useState(modelConfigService.getDefaultConfig());
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await modelConfigService.getModelConfigs();
      setConfigs(data);
    } catch (error) {
      showNotification('加载配置失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // 清除相关错误
    if (errors.length > 0) {
      const newErrors = errors.filter(error => !error.includes(field));
      setErrors(newErrors);
    }
  };

  const handleStopSequencesChange = (value) => {
    try {
      const sequences = value.split(',').map(s => s.trim()).filter(s => s);
      handleInputChange('stop_sequences', sequences);
    } catch (error) {
      handleInputChange('stop_sequences', []);
    }
  };

  const validateForm = () => {
    const validationErrors = modelConfigService.validateConfig(formData);
    setErrors(validationErrors);
    return validationErrors.length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      if (isCreating) {
        await modelConfigService.createModelConfig(formData);
        showNotification('配置创建成功', 'success');
        setIsCreating(false);
      } else {
        await modelConfigService.updateModelConfig(editingConfig.id, formData);
        showNotification('配置更新成功', 'success');
        setEditingConfig(null);
      }
      
      setFormData(modelConfigService.getDefaultConfig());
      loadConfigs();
    } catch (error) {
      showNotification('保存失败: ' + error.message, 'error');
    }
  };

  const handleEdit = (config) => {
    setEditingConfig(config);
    setFormData({
      ...config,
      stop_sequences: config.stop_sequences || []
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除这个配置吗？')) {
      return;
    }

    try {
      await modelConfigService.deleteModelConfig(id);
      showNotification('配置删除成功', 'success');
      loadConfigs();
    } catch (error) {
      showNotification('删除失败: ' + error.message, 'error');
    }
  };

  const handleTestConnection = async () => {
    if (!formData.api_key || !formData.model_type) {
      showNotification('请先填写API密钥和模型类型', 'error');
      return;
    }

    try {
      setTestingConnection(true);
      const result = await modelConfigService.testConnection({
        api_key: formData.api_key,
        api_url: formData.api_url,
        model_type: formData.model_type,
        model_name: formData.model_name
      });
      
      if (result.success) {
        showNotification('连接测试成功!', 'success');
      } else {
        showNotification('连接测试失败: ' + result.message, 'error');
      }
    } catch (error) {
      showNotification('连接测试失败: ' + error.message, 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCancel = () => {
    setEditingConfig(null);
    setIsCreating(false);
    setFormData(modelConfigService.getDefaultConfig());
    setErrors([]);
  };

  const getModelOptions = () => {
    switch (formData.model_type) {
      case 'openai':
        return modelConfigService.getOpenAIModels();
      case 'claude':
        return modelConfigService.getClaudeModels();
      default:
        return [];
    }
  };

  if (loading) {
    return (
      <div className="model-config-manager">
        <div className="loading">
          <FaSpinner className="spinner" />
          <p>加载配置...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="model-config-manager">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <div className="manager-header">
        <h2>模型配置管理</h2>
        {!isCreating && !editingConfig && (
          <button 
            className="btn btn-primary"
            onClick={() => setIsCreating(true)}
          >
            <FaPlus /> 新建配置
          </button>
        )}
      </div>

      {(isCreating || editingConfig) && (
        <div className="config-form">
          <h3>{isCreating ? '新建配置' : '编辑配置'}</h3>
          
          {errors.length > 0 && (
            <div className="error-messages">
              {errors.map((error, index) => (
                <div key={index} className="error-message">{error}</div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>配置名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="输入配置名称"
                  required
                />
              </div>

              <div className="form-group">
                <label>模型类型 *</label>
                <select
                  value={formData.model_type}
                  onChange={(e) => handleInputChange('model_type', e.target.value)}
                  required
                >
                  {modelConfigService.getModelTypes().map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>模型名称</label>
                <select
                  value={formData.model_name}
                  onChange={(e) => handleInputChange('model_name', e.target.value)}
                >
                  <option value="">选择模型</option>
                  {getModelOptions().map(model => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>API密钥 *</label>
                <input
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => handleInputChange('api_key', e.target.value)}
                  placeholder="输入API密钥"
                  required
                />
              </div>

              <div className="form-group">
                <label>自定义API URL</label>
                <input
                  type="url"
                  value={formData.api_url}
                  onChange={(e) => handleInputChange('api_url', e.target.value)}
                  placeholder="留空使用默认URL"
                />
              </div>

              <div className="form-group">
                <label>温度 (0-2)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={formData.temperature}
                  onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>最大令牌数</label>
                <input
                  type="number"
                  min="1"
                  max="32000"
                  value={formData.max_tokens}
                  onChange={(e) => handleInputChange('max_tokens', parseInt(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Top P (0-1)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={formData.top_p}
                  onChange={(e) => handleInputChange('top_p', parseFloat(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Top K (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.top_k}
                  onChange={(e) => handleInputChange('top_k', parseInt(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>频率惩罚 (-2 to 2)</label>
                <input
                  type="number"
                  step="0.1"
                  min="-2"
                  max="2"
                  value={formData.frequency_penalty}
                  onChange={(e) => handleInputChange('frequency_penalty', parseFloat(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>存在惩罚 (-2 to 2)</label>
                <input
                  type="number"
                  step="0.1"
                  min="-2"
                  max="2"
                  value={formData.presence_penalty}
                  onChange={(e) => handleInputChange('presence_penalty', parseFloat(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>停止序列</label>
                <input
                  type="text"
                  value={formData.stop_sequences.join(', ')}
                  onChange={(e) => handleStopSequencesChange(e.target.value)}
                  placeholder="用逗号分隔，如: ###, END"
                />
              </div>

              <div className="form-group">
                <label>流式输出</label>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={formData.stream}
                    onChange={(e) => handleInputChange('stream', e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="form-group">
                <label>对数概率</label>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={formData.logprobs}
                    onChange={(e) => handleInputChange('logprobs', e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="form-group">
                <label>Top Logprobs (0-20)</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={formData.top_logprobs}
                  onChange={(e) => handleInputChange('top_logprobs', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={handleTestConnection}
                disabled={testingConnection}
              >
                {testingConnection ? <FaSpinner className="spinner" /> : <FaFlask />}
                {testingConnection ? '测试中...' : '测试连接'}
              </button>
              
              <div className="action-buttons">
                <button type="submit" className="btn btn-primary">
                  <FaSave /> 保存
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  <FaTimes /> 取消
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="configs-list">
        <h3>现有配置</h3>
        {configs.length === 0 ? (
          <div className="no-configs">
            <p>暂无配置，点击"新建配置"开始创建</p>
          </div>
        ) : (
          <div className="configs-grid">
            {configs.map(config => (
              <div key={config.id} className="config-card">
                <div className="config-header">
                  <h4>{config.name}</h4>
                  <div className="config-actions">
                    <button 
                      className="btn-icon"
                      onClick={() => handleEdit(config)}
                      title="编辑"
                    >
                      <FaEdit />
                    </button>
                    <button 
                      className="btn-icon btn-danger"
                      onClick={() => handleDelete(config.id)}
                      title="删除"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
                
                <div className="config-details">
                  <div className="config-item">
                    <span className="label">模型类型:</span>
                    <span className="value">{config.model_type}</span>
                  </div>
                  <div className="config-item">
                    <span className="label">模型名称:</span>
                    <span className="value">{config.model_name || '默认'}</span>
                  </div>
                  <div className="config-item">
                    <span className="label">温度:</span>
                    <span className="value">{config.temperature}</span>
                  </div>
                  <div className="config-item">
                    <span className="label">最大令牌:</span>
                    <span className="value">{config.max_tokens}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelConfigManager;