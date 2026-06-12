import React, { useState, useEffect } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Layout,
  Modal,
  Row,
  Select,
  Slider,
  Switch,
  Typography,
  Spin,
  Empty,
  notification,
  Popconfirm,
  Tag,
  Space
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  SaveOutlined,
  CloseOutlined,
  ApiOutlined,
  LoadingOutlined,
  QuestionCircleOutlined,
  SyncOutlined
} from '@ant-design/icons';
import modelConfigService from '../services/modelConfigService';
import './ModelConfigManager.css';

const { Title, Text } = Typography;
const { Option } = Select;

const ModelConfigManager = () => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [form] = Form.useForm();
  const modelType = Form.useWatch('model_type', form);
  const enableProxy = Form.useWatch('enable_proxy', form);
  const [modelList, setModelList] = useState([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await modelConfigService.getModelConfigs();
      setConfigs(data);
    } catch (error) {
      notification.error({
        message: '加载配置失败',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const showModal = (config = null) => {
    setEditingConfig(config);
    setModelList([]);
    if (config) {
      form.setFieldsValue({
        ...config,
        api_key: '',
        stop_sequences: config.stop_sequences ? config.stop_sequences.join(', ') : '',
      });
    } else {
      const defaultConfig = modelConfigService.getDefaultConfig();
      // 确保stop_sequences是字符串格式
      if (Array.isArray(defaultConfig.stop_sequences)) {
        defaultConfig.stop_sequences = defaultConfig.stop_sequences.join(', ');
      }
      form.setFieldsValue(defaultConfig);
    }
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
    setEditingConfig(null);
  };

  const handleSubmit = async (values) => {
    try {
      // 处理stop_sequences字段：如果是字符串则分割，如果是数组则直接使用
      let stop_sequences = [];
      if (values.stop_sequences) {
        if (typeof values.stop_sequences === 'string') {
          stop_sequences = values.stop_sequences.split(',').map(s => s.trim()).filter(s => s);
        } else if (Array.isArray(values.stop_sequences)) {
          stop_sequences = values.stop_sequences;
        }
      }
      
      // 如果未启用代理，清空proxy_url字段
      if (!values.enable_proxy) {
        values.proxy_url = '';
      }
      
      const submitData = { ...values, stop_sequences };

      if (editingConfig && !submitData.api_key) {
        delete submitData.api_key;
      }

      if (editingConfig) {
        await modelConfigService.updateModelConfig(editingConfig.id, submitData);
        notification.success({ message: '配置更新成功' });
      } else {
        await modelConfigService.createModelConfig(submitData);
        notification.success({ message: '配置创建成功' });
      }
      
      handleCancel();
      loadConfigs();
    } catch (error) {
      notification.error({
        message: '保存失败',
        description: error.message,
      });
    }
  };

  const handleDelete = async (id) => {
    try {
      await modelConfigService.deleteModelConfig(id);
      notification.success({ message: '配置删除成功' });
      loadConfigs();
    } catch (error) {
      notification.error({
        message: '删除失败',
        description: error.message,
      });
    }
  };

  const handleCopyConfig = (config) => {
    // 创建配置的副本，去掉id和用户相关字段
    const { id, user_id, created_at, updated_at, api_key_masked, ...configCopy } = config;
    
    // 为复制的配置添加后缀
    configCopy.name = `${config.name} (副本)`;
    // 出于安全考虑，API密钥需要用户重新输入
    
    setEditingConfig(null);
    setModelList([]);
    form.setFieldsValue({
      ...configCopy,
      api_key: '', // 清空API密钥，需要用户重新输入
      stop_sequences: configCopy.stop_sequences ? configCopy.stop_sequences.join(', ') : '',
    });
    setIsModalVisible(true);
    
    notification.info({ 
      message: '配置已复制', 
      description: '所有参数已复制，但出于安全考虑需要重新输入API密钥' 
    });
  };

  const handleTestConnection = async () => {
    try {
      const values = await form.validateFields(['model_type', 'api_url', 'model_name']);
      let apiKey = form.getFieldValue('api_key');
      setTestingConnection(true);
      let result;

      if (editingConfig && !apiKey) {
        // 编辑模式，且没有输入新密钥，则测试已保存的密钥
        const proxyStatus = editingConfig.enable_proxy ? ' (使用代理)' : ' (直连)';
        notification.info({
          message: `正在使用已保存的密钥进行测试${proxyStatus}...`
        });
        result = await modelConfigService.testExistingConnection(editingConfig.id);
      } else if (apiKey) {
        // 新建模式，或编辑模式下输入了新密钥
        const proxyUrl = values.enable_proxy ? values.proxy_url : null;
        const proxyStatus = values.enable_proxy ? ' (使用代理)' : ' (直连)';
        notification.info({
          message: `正在测试连接${proxyStatus}...`
        });
        result = await modelConfigService.testConnection({
          api_key: apiKey,
          api_url: values.api_url,
          model_type: values.model_type,
          model_name: values.model_name,
          proxy_url: proxyUrl
        });
      } else {
        notification.error({ message: '请输入API密钥以进行测试' });
        setTestingConnection(false);
        return;
      }

      if (result.success) {
        const proxyStatus = (values.enable_proxy || (editingConfig && editingConfig.enable_proxy)) ? ' (使用代理)' : ' (直连)';
        notification.success({ 
          message: `连接测试成功${proxyStatus}!`,
          description: result.message 
        });
      } else {
        notification.error({ 
          message: '连接测试失败', 
          description: result.message 
        });
      }
    } catch (error) {
        if (error.errorFields) {
            notification.error({ message: '请先填写模型类型等必填项' });
        } else {
            notification.error({ message: '连接测试失败', description: error.message });
        }
    } finally {
      setTestingConnection(false);
    }
  };

  const handleFetchModels = async () => {
    try {
      const modelType = form.getFieldValue('model_type');
      if (!modelType) {
        notification.error({ message: '请先选择模型类型' });
        return;
      }

      let apiKey = form.getFieldValue('api_key');
      setFetchingModels(true);
      let models;

      if (editingConfig && !apiKey) {
        // 编辑模式，且没有输入新密钥，则使用已保存的密钥获取
        notification.info({ message: '正在使用已保存的密钥获取模型列表...' });
        models = await modelConfigService.listAvailableModelsById(editingConfig.id);
      } else if (apiKey) {
        // 新建模式，或编辑模式下输入了新密钥
        const enableProxy = form.getFieldValue('enable_proxy');
        const proxyUrl = enableProxy ? form.getFieldValue('proxy_url') : null;
        models = await modelConfigService.listAvailableModels(apiKey, modelType, proxyUrl);
      } else {
        notification.error({ message: '请输入API密钥以获取模型列表' });
        setFetchingModels(false);
        return;
      }

      setModelList(models);
      notification.success({ message: '模型列表获取成功' });
    } catch (error) {
      notification.error({ message: '获取模型列表失败', description: error.message });
      setModelList([]);
    } finally {
      setFetchingModels(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
      </div>
    );
  }

  return (
    <Layout style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={3}>模型配置管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
          新建配置
        </Button>
      </div>

      {configs.length === 0 ? (
        <Empty description="暂无配置，点击'新建配置'开始创建" />
      ) : (
        <Row gutter={[12, 12]}>
          {configs.map(config => (
            <Col xs={24} sm={12} md={8} lg={6} xl={4} key={config.id}>
              <Card
                size="small"
                title={
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {config.name}
                  </div>
                }
                actions={[
                  <CopyOutlined 
                    key="copy" 
                    style={{ fontSize: '14px' }} 
                    onClick={() => handleCopyConfig(config)}
                    title="复制配置"
                  />,
                  <EditOutlined 
                    key="edit" 
                    style={{ fontSize: '14px' }} 
                    onClick={() => showModal(config)} 
                    title="编辑配置"
                  />,
                  <Popconfirm
                    title="确定要删除这个配置吗？"
                    onConfirm={() => handleDelete(config.id)}
                    okText="删除"
                    cancelText="取消"
                    icon={<QuestionCircleOutlined style={{ color: 'var(--error-color)' }} />}
                  >
                    <DeleteOutlined 
                      key="delete" 
                      style={{ fontSize: '14px' }} 
                      title="删除配置"
                    />
                  </Popconfirm>,
                ]}
                bodyStyle={{ padding: '12px' }}
              >
                <div style={{ marginBottom: '8px' }}>
                  <Tag style={{ fontSize: '11px', background: 'var(--primary-color)', color: 'var(--active-menu-text)', borderColor: 'var(--primary-color)' }}>{config.model_type}</Tag>
                  {config.enable_proxy && (
                    <Tag style={{ fontSize: '11px', marginLeft: '4px', background: 'var(--success-color)', color: 'var(--active-menu-text)', borderColor: 'var(--success-color)' }}>代理</Tag>
                  )}
                </div>
                <div style={{ fontSize: '12px', lineHeight: '1.4', color: 'var(--secondary-text-color)' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>模型:</strong> {config.model_name || '默认'}
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>温度:</strong> {config.temperature}
                  </div>
                  <div>
                    <strong>令牌:</strong> {config.max_tokens}
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title={editingConfig ? '编辑配置' : '新建配置'}
        open={isModalVisible}
        onCancel={handleCancel}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="配置名称"
                rules={[{ required: true, message: '请输入配置名称' }]}
              >
                <Input placeholder="输入配置名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="model_type"
                label="模型类型"
                rules={[{ required: true, message: '请选择模型类型' }]}
              >
                <Select placeholder="选择模型类型" onChange={() => setModelList([])}>
                  {modelConfigService.getModelTypes().map(type => (
                    <Option key={type.value} value={type.value}>
                      {type.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="api_key"
                label="API密钥"
                rules={[{ required: !editingConfig, message: '请输入API密钥' }]}
                extra={editingConfig ? (
                  <div>
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ color: 'var(--secondary-text-color)', fontSize: '12px' }}>
                        当前密钥: {editingConfig.api_key_masked}
                      </span>
                    </div>
                    <div style={{ color: 'var(--muted-text-color)', fontSize: '11px' }}>
                      💡 留空保持原密钥，输入新密钥则替换
                    </div>
                  </div>
                ) : ''}
              >
                <Input.Password 
                  placeholder={editingConfig ? "输入新密钥（可选）" : "输入API密钥"} 
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="模型名称"
                extra={modelType !== 'custom' && "点击右侧按钮获取模型列表"}
              >
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item
                    name="model_name"
                    noStyle
                    rules={[{ required: modelType === 'custom', message: '请输入自定义模型名称' }]}
                  >
                    {modelType === 'custom' ? (
                      <Input placeholder="输入自定义模型名称" />
                    ) : (
                      <Select placeholder="选择模型" allowClear loading={fetchingModels}>
                        {modelList.map(model => (
                          <Option key={model.value} value={model.value}>
                            {model.label}
                          </Option>
                        ))}
                      </Select>
                    )}
                  </Form.Item>
                  {modelType !== 'custom' && (
                    <Button 
                      icon={<SyncOutlined />} 
                      onClick={handleFetchModels} 
                      loading={fetchingModels}
                      style={{ 
                        height: '32px',
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0
                      }}
                    />
                  )}
                </Space.Compact>
              </Form.Item>
            </Col>
            {modelType === 'custom' && (
              <Col span={24}>
                <Form.Item
                  name="api_url"
                  label="自定义API URL"
                  extra="留空使用默认URL"
                  rules={[{ required: true, message: '自定义模型需要提供API URL' }]}
                >
                  <Input placeholder="https://api.example.com/v1" />
                </Form.Item>
              </Col>
            )}
            <Col span={24}>
              <Form.Item 
                name="enable_proxy" 
                label="启用代理" 
                valuePropName="checked"
                extra="开启后需要填写代理地址"
              >
                <Switch />
              </Form.Item>
            </Col>
            {enableProxy && (
              <Col span={24}>
                <Form.Item
                  name="proxy_url"
                  label="代理URL"
                  extra="请输入代理服务器的URL"
                  rules={[
                    { required: true, message: '启用代理时必须填写代理URL' }
                  ]}
                >
                  <Input placeholder="http://127.0.0.1:7890" />
                </Form.Item>
              </Col>
            )}
            <Col span={12}>
              <Form.Item label="温度 (0-2)">
                <Row>
                  <Col span={12}>
                    <Form.Item name="temperature" noStyle>
                      <Slider min={0} max={2} step={0.1} />
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item name="temperature" noStyle>
                      <InputNumber min={0} max={2} step={0.1} style={{ margin: '0 16px' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="max_tokens"
                label="最大令牌数"
              >
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Top P (0-1)">
                <Row>
                  <Col span={12}>
                    <Form.Item name="top_p" noStyle>
                      <Slider min={0} max={1} step={0.1} />
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item name="top_p" noStyle>
                      <InputNumber min={0} max={1} step={0.1} style={{ margin: '0 16px' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="top_k"
                label="Top K (0-100)"
              >
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="频率惩罚 (-2 to 2)">
                <Row>
                  <Col span={12}>
                    <Form.Item name="frequency_penalty" noStyle>
                      <Slider min={-2} max={2} step={0.1} />
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item name="frequency_penalty" noStyle>
                      <InputNumber min={-2} max={2} step={0.1} style={{ margin: '0 16px' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="存在惩罚 (-2 to 2)">
                <Row>
                  <Col span={12}>
                    <Form.Item name="presence_penalty" noStyle>
                      <Slider min={-2} max={2} step={0.1} />
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item name="presence_penalty" noStyle>
                      <InputNumber min={-2} max={2} step={0.1} style={{ margin: '0 16px' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="stop_sequences"
                label="停止序列"
                extra="用逗号分隔, 如: ###, END"
              >
                <Input placeholder="###, END" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="stream" label="流式输出" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="logprobs" label="对数概率" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="top_logprobs"
                label="Top Logprobs (0-20)"
              >
                <InputNumber min={0} max={20} />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
            <Button
              icon={<ApiOutlined />}
              onClick={handleTestConnection}
              loading={testingConnection}
            >
              测试连接
            </Button>
            <div>
              <Button onClick={handleCancel} style={{ marginRight: 8 }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </div>
          </div>
        </Form>
      </Modal>
    </Layout>
  );
};

export default ModelConfigManager;