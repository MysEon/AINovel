import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Flex, 
  Button, 
  Heading, 
  Text, 
  HStack, 
  VStack,
  Icon,
  Spinner,
  Grid,
  Badge,
  // Divider removed
  Input,
  Select,
  Switch,
  Field,
  FieldLabel,
  FieldErrorText,
  // Alert components removed - using custom notification instead
  CloseButton
} from '@chakra-ui/react';
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaFlask, FaCheck, FaSpinner as FaSpinnerIcon } from 'react-icons/fa';
import modelConfigService from '../services/modelConfigService';
import { useNotification } from './NotificationManager';
import UniversalDialog from './UniversalDialog';
import './ModelConfigManager.css';

const ModelConfigManager = () => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingConfig, setEditingConfig] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState(null);
  const { addNotification } = useNotification();

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
    addNotification({ message, type, duration: 3000 });
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
    const validationData = { 
      ...formData,
      api_key_masked: editingConfig && editingConfig.api_key_masked
    };
    const validationErrors = modelConfigService.validateConfig(validationData);
    setErrors(validationErrors);
    return validationErrors.length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      let submitData = { ...formData };
      
      // 如果是编辑模式且API密钥为空，则从表单数据中移除api_key字段
      // 这样后端就不会更新API密钥
      if (editingConfig && editingConfig.api_key_masked && !submitData.api_key) {
        delete submitData.api_key;
      }
      
      if (isCreating) {
        await modelConfigService.createModelConfig(submitData);
        showNotification('配置创建成功', 'success');
        setIsCreating(false);
      } else {
        await modelConfigService.updateModelConfig(editingConfig.id, submitData);
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
      api_key: '',  // 清空API密钥字段，显示遮蔽版本
      stop_sequences: config.stop_sequences || []
    });
    
    // 显示遮蔽的API密钥提示
    if (config.api_key_masked) {
      showNotification(`当前API密钥: ${config.api_key_masked}`, 'info');
    }
  };

  const handleDelete = async (id) => {
    const config = configs.find(c => c.id === id);
    if (config) {
      setDeleteConfirmDialog({
        id: id,
        name: config.name
      });
    }
  };

  const confirmDelete = async (id) => {
    try {
      await modelConfigService.deleteModelConfig(id);
      showNotification('配置删除成功', 'success');
      loadConfigs();
    } catch (error) {
      showNotification('删除失败: ' + error.message, 'error');
    } finally {
      // 确保在删除操作完成后关闭确认对话框
      setDeleteConfirmDialog(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmDialog(null);
  };

  const handleTestConnection = async () => {
    if (!formData.api_key || !formData.model_type) {
      showNotification('请先填写API密钥和模型类型', 'error');
      return;
    }

    // 自定义模型需要额外的验证
    if (formData.model_type === 'custom') {
      if (!formData.api_url) {
        showNotification('自定义模型必须提供API URL', 'error');
        return;
      }
      if (!formData.model_name) {
        showNotification('自定义模型必须提供模型名称', 'error');
        return;
      }
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
      <Box h="100vh" display="flex" alignItems="center" justifyContent="center" bg="bg.canvas">
        <VStack spacing={4}>
          <Spinner size="xl" color="brand.500" />
          <Text color="text.muted">加载配置...</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box h="100vh" display="flex" flexDirection="column" bg="bg.canvas" p={6}>
      {/* 头部 */}
      <Box 
        bg="white" 
        _dark={{ bg: "gray.800" }}
        borderRadius="lg" 
        boxShadow="sm" 
        p={6} 
        mb={6}
      >
        <Flex justify="space-between" align="center">
          <Heading size="lg" color="text.primary">模型配置管理</Heading>
          {!isCreating && !editingConfig && (
            <Button
              leftIcon={<Icon as={FaPlus} />}
              colorScheme="brand"
              onClick={() => setIsCreating(true)}
            >
              新建配置
            </Button>
          )}
        </Flex>
      </Box>

      {(isCreating || editingConfig) && (
        <Box 
          bg="white" 
          _dark={{ bg: "gray.800" }}
          borderRadius="lg" 
          boxShadow="sm" 
          p={6} 
          mb={6}
        >
          <VStack spacing={4} align="stretch">
            <Heading size="md" color="text.primary">
              {isCreating ? '新建配置' : '编辑配置'}
            </Heading>
            
            {errors.length > 0 && (
              <Box 
                bg="red.50" 
                _dark={{ bg: "red.900", borderColor: "red.700" }}
                borderRadius="md" 
                p={4}
                border="1px"
                borderColor="red.200"
              >
                <VStack spacing={2} align="stretch">
                  <Heading size="sm" color="red.800" _dark={{ color: "red.200" }}>
                    表单验证错误
                  </Heading>
                  <VStack spacing={1} align="stretch">
                    {errors.map((error, index) => (
                      <Text key={index} fontSize="sm" color="red.700" _dark={{ color: "red.300" }}>
                        {error}
                      </Text>
                    ))}
                  </VStack>
                </VStack>
              </Box>
            )}

            <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                <Field required>
                  <FieldLabel color="text.primary">配置名称</FieldLabel>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="输入配置名称"
                  />
                </Field>

                <Field required>
                  <FieldLabel color="text.primary">模型类型</FieldLabel>
                  <Select
                    value={formData.model_type}
                    onChange={(e) => handleInputChange('model_type', e.target.value)}
                  >
                    {modelConfigService.getModelTypes().map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field>
                  <FieldLabel color="text.primary">模型名称</FieldLabel>
                  {formData.model_type === 'custom' ? (
                    <Input
                      value={formData.model_name}
                      onChange={(e) => handleInputChange('model_name', e.target.value)}
                      placeholder="输入自定义模型名称"
                    />
                  ) : (
                    <Select
                      value={formData.model_name}
                      onChange={(e) => handleInputChange('model_name', e.target.value)}
                    >
                      <option value="">选择模型</option>
                      {getModelOptions().map(model => (
                        <option key={model.value} value={model.value}>
                          {model.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>

                <Field required={!editingConfig || !editingConfig.api_key_masked}>
                  <FieldLabel color="text.primary">API密钥</FieldLabel>
                  <Input
                    type="password"
                    value={formData.api_key}
                    onChange={(e) => handleInputChange('api_key', e.target.value)}
                    placeholder={editingConfig && editingConfig.api_key_masked ? `当前: ${editingConfig.api_key_masked}` : "输入API密钥"}
                  />
                  {editingConfig && editingConfig.api_key_masked && (
                    <Text fontSize="xs" color="text.muted" mt={1}>
                      留空则保持现有密钥不变，输入新密钥将替换现有密钥
                    </Text>
                  )}
                </Field>

                <Field>
                  <FieldLabel color="text.primary">自定义API URL</FieldLabel>
                  <Input
                    type="url"
                    value={formData.api_url}
                    onChange={(e) => handleInputChange('api_url', e.target.value)}
                    placeholder="留空使用默认URL"
                  />
                </Field>

                <Field>
                  <FieldLabel color="text.primary">温度 (0-2)</FieldLabel>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={formData.temperature}
                    onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
                  />
                </Field>

                <Field>
                  <FieldLabel color="text.primary">最大令牌数</FieldLabel>
                  <Input
                    type="number"
                    min="1"
                    value={formData.max_tokens}
                    onChange={(e) => handleInputChange('max_tokens', parseInt(e.target.value))}
                  />
                </Field>

                <Field>
                  <FieldLabel color="text.primary">Top P (0-1)</FieldLabel>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={formData.top_p}
                    onChange={(e) => handleInputChange('top_p', parseFloat(e.target.value))}
                  />
                </Field>

                <Field>
                  <FieldLabel color="text.primary">Top K (0-100)</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.top_k}
                    onChange={(e) => handleInputChange('top_k', parseInt(e.target.value))}
                  />
                </Field>

                <Field>
                  <FieldLabel color="text.primary">频率惩罚 (-2 to 2)</FieldLabel>
                  <Input
                    type="number"
                    step="0.1"
                    min="-2"
                    max="2"
                    value={formData.frequency_penalty}
                    onChange={(e) => handleInputChange('frequency_penalty', parseFloat(e.target.value))}
                  />
                </Field>

                <Field>
                  <FieldLabel color="text.primary">存在惩罚 (-2 to 2)</FieldLabel>
                  <Input
                    type="number"
                    step="0.1"
                    min="-2"
                    max="2"
                    value={formData.presence_penalty}
                    onChange={(e) => handleInputChange('presence_penalty', parseFloat(e.target.value))}
                  />
                </Field>

                <Field>
                  <FieldLabel color="text.primary">停止序列</FieldLabel>
                  <Input
                    value={formData.stop_sequences.join(', ')}
                    onChange={(e) => handleStopSequencesChange(e.target.value)}
                    placeholder="用逗号分隔，如: ###, END"
                  />
                </Field>

                <Field>
                  <FieldLabel color="text.primary">流式输出</FieldLabel>
                  <Switch
                    isChecked={formData.stream}
                    onChange={(e) => handleInputChange('stream', e.target.checked)}
                  />
                </Field>

                <Field>
                  <FieldLabel color="text.primary">对数概率</FieldLabel>
                  <Switch
                    isChecked={formData.logprobs}
                    onChange={(e) => handleInputChange('logprobs', e.target.checked)}
                  />
                </Field>

                <Field>
                  <FieldLabel color="text.primary">Top Logprobs (0-20)</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    max="20"
                    value={formData.top_logprobs}
                    onChange={(e) => handleInputChange('top_logprobs', parseInt(e.target.value))}
                  />
                </Field>
              </Grid>

            <Box borderBottom="1px" borderColor="border.default" my={4} />
              
              <Flex justify="space-between" align="center">
                <Button
                  leftIcon={testingConnection ? <Spinner size="sm" /> : <Icon as={FaFlask} />}
                  onClick={handleTestConnection}
                  isDisabled={testingConnection}
                  colorScheme="orange"
                  variant="outline"
                >
                  {testingConnection ? '测试中...' : '测试连接'}
                </Button>
                
                <HStack spacing={3}>
                  <Button 
                    type="submit"
                    colorScheme="brand"
                  >
                    <Icon as={FaSave} mr={2} />
                    保存
                  </Button>
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                  >
                    <Icon as={FaTimes} mr={2} />
                    取消
                  </Button>
                </HStack>
              </Flex>
            </form>
          </VStack>
        </Box>
      )}

      {/* 配置列表 */}
      <Box 
        bg="white" 
        _dark={{ bg: "gray.800" }}
        borderRadius="lg" 
        boxShadow="sm" 
        flex="1"
        overflow="hidden"
        display="flex" 
        flexDirection="column"
      >
        <Box p={6} borderBottom="1px" borderColor="border.default">
          <Heading size="md" color="text.primary">现有配置</Heading>
        </Box>
        
        <Box flex="1" overflow="auto" p={6}>
          {configs.length === 0 ? (
            <Box 
              bg="gray.50" 
              _dark={{ bg: "gray.900" }}
              borderRadius="md" 
              p={8} 
              textAlign="center"
            >
              <VStack spacing={3}>
                <Text fontSize="3xl">⚙️</Text>
                <Text color="text.muted">暂无配置，点击"新建配置"开始创建</Text>
              </VStack>
            </Box>
          ) : (
            <Grid templateColumns="repeat(auto-fill, minmax(300px, 1fr))" gap={4}>
              {configs.map(config => (
                <Box 
                  key={config.id} 
                  bg="gray.50" 
                  _dark={{ bg: "gray.900" }}
                  borderRadius="md" 
                  p={4}
                  border="1px"
                  borderColor="border.default"
                >
                  <HStack justify="space-between" align="start" mb={3}>
                    <Heading size="sm" color="text.primary">{config.name}</Heading>
                    <HStack spacing={1}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(config)}
                        title="编辑"
                      >
                        <Icon as={FaEdit} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => handleDelete(config.id)}
                        title="删除"
                      >
                        <Icon as={FaTrash} />
                      </Button>
                    </HStack>
                  </HStack>
                  
                  <VStack spacing={2} align="stretch">
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="text.muted">模型类型:</Text>
                      <Badge variant="outline" fontSize="xs">{config.model_type}</Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="text.muted">模型名称:</Text>
                      <Text fontSize="sm" color="text.primary">{config.model_name || '默认'}</Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="text.muted">温度:</Text>
                      <Text fontSize="sm" color="text.primary">{config.temperature}</Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="text.muted">最大令牌:</Text>
                      <Text fontSize="sm" color="text.primary">{config.max_tokens}</Text>
                    </HStack>
                  </VStack>
                </Box>
              ))}
            </Grid>
          )}
        </Box>
      </Box>

      {deleteConfirmDialog && (
        <UniversalDialog
          title="删除配置"
          message={`确定要删除配置 "${deleteConfirmDialog.name}" 吗？此操作无法撤销。`}
          type="warning"
          confirmText="删除"
          cancelText="取消"
          onConfirm={() => confirmDelete(deleteConfirmDialog.id)}
          onCancel={cancelDelete}
        />
      )}
    </Box>
  );
};

export default ModelConfigManager;