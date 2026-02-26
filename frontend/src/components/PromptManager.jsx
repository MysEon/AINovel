import React, { useState, useEffect } from 'react';
import { Modal, Button, Table, Input, Select, Tag, Space, Popconfirm, message, Tooltip, Card, Row, Col, Typography } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  EyeOutlined,
  SearchOutlined,
  BulbOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { promptService } from '../services/promptService';
import './PromptManager.css';

const { Search } = Input;
const { Option } = Select;
const { TextArea } = Input;
const { Title } = Typography;

const PromptManager = ({ onSelectTemplate }) => {
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [includeSystem, setIncludeSystem] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    template: '',
    description: '',
    variables: '',
    tags: '',
    is_active: true
  });
  const [previewData, setPreviewData] = useState({
    rendered: '',
    missing_variables: []
  });

  // 获取提示词模板列表
  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await promptService.getTemplates({
        search: searchText,
        category: selectedCategory,
        include_system: includeSystem,
        only_active: true,
      });
      setTemplates(data);
    } catch (error) {
      message.error(error.message || '获取提示词模板失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取分类列表
  const fetchCategories = async () => {
    try {
      const data = await promptService.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('获取分类失败:', error);
    }
  };

  const initializeSystemTemplates = async () => {
    try {
      const data = await promptService.initializeSystemTemplates();
      message.success(data.message);
      fetchTemplates();
    } catch (error) {
      message.error(error.message || '初始化系统模板失败');
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchTemplates();
  }, [searchText, selectedCategory, includeSystem]);

  // 新建/编辑模板
  const handleEdit = (template = null) => {
    if (template) {
      setCurrentTemplate(template);
      setFormData({
        name: template.name,
        category: template.category,
        template: template.template,
        description: template.description || '',
        variables: template.variables || '',
        tags: template.tags || '',
        is_active: template.is_active
      });
    } else {
      setCurrentTemplate(null);
      setFormData({
        name: '',
        category: '',
        template: '',
        description: '',
        variables: '',
        tags: '',
        is_active: true
      });
    }
    setEditModalVisible(true);
  };

  // 保存模板
  const handleSave = async () => {
    try {
      if (currentTemplate) {
        await promptService.updateTemplate(currentTemplate.id, formData);
      } else {
        await promptService.createTemplate(formData);
      }
      message.success(currentTemplate ? '模板更新成功' : '模板创建成功');
      setEditModalVisible(false);
      fetchTemplates();
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  // 复制模板
  const handleCopy = async (template) => {
    try {
      await promptService.copyTemplate(template.id);
      message.success('模板复制成功');
      fetchTemplates();
    } catch (error) {
      message.error(error.message || '复制失败');
    }
  };

  const handleDelete = async (template) => {
    try {
      await promptService.deleteTemplate(template.id);
      message.success('模板删除成功');
      fetchTemplates();
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  // 预览模板
  const handlePreview = async (template) => {
    try {
      const data = await promptService.previewTemplate(template.id);
      setPreviewData(data);
      setCurrentTemplate(template);
      setPreviewModalVisible(true);
    } catch (error) {
      message.error(error.message || '预览失败');
    }
  };

  // 使用模板
  const handleUseTemplate = async (template) => {
    try {
      await promptService.useTemplate(template.id);
    } catch {
      // 即使记录失败也继续使用模板
    }
    if (onSelectTemplate) {
      onSelectTemplate(template);
    }
    message.success('模板已选择，可以在AI助手中使用');
  };
  };

  const columns = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <span>{text}</span>
          {record.is_system && <Tag color="blue">系统</Tag>}
          {!record.is_active && <Tag color="red">已禁用</Tag>}
        </Space>
      )
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category) => {
        const categoryInfo = categories.find(c => c.value === category);
        return categoryInfo ? categoryInfo.label : category;
      }
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags) => tags ? tags.split(',').map(tag => 
        <Tag key={tag} size="small">{tag.trim()}</Tag>
      ) : null
    },
    {
      title: '使用次数',
      dataIndex: 'usage_count',
      key: 'usage_count',
      sorter: (a, b) => a.usage_count - b.usage_count
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="使用模板">
            <Button 
              type="primary" 
              icon={<BulbOutlined />}
              size="small"
              onClick={() => handleUseTemplate(record)}
            />
          </Tooltip>
          <Tooltip title="预览">
            <Button 
              icon={<EyeOutlined />} 
              size="small"
              onClick={() => handlePreview(record)}
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button 
              icon={<CopyOutlined />} 
              size="small"
              onClick={() => handleCopy(record)}
            />
          </Tooltip>
          {!record.is_system && (
            <>
              <Tooltip title="编辑">
                <Button 
                  icon={<EditOutlined />} 
                  size="small"
                  onClick={() => handleEdit(record)}
                />
              </Tooltip>
              <Popconfirm
                title="确定删除此模板吗？"
                onConfirm={() => handleDelete(record)}
                okText="确定"
                cancelText="取消"
              >
                <Tooltip title="删除">
                  <Button 
                    danger 
                    icon={<DeleteOutlined />} 
                    size="small"
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className="prompt-manager-container">
      <Card className="prompt-manager-card">
        <Title level={2} style={{ marginBottom: 24 }}>提示词管理</Title>
        
        {/* 工具栏 */}
        <Row gutter={16} className="prompt-manager-toolbar">
          <Col span={8}>
            <Search
              placeholder="搜索模板名称、描述或标签"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onSearch={fetchTemplates}
              enterButton={<SearchOutlined />}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="选择分类"
              value={selectedCategory}
              onChange={setSelectedCategory}
              allowClear
              style={{ width: '100%' }}
            >
              {categories.map(category => (
                <Option key={category.value} value={category.value}>
                  {category.label}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={4}>
            <Select
              value={includeSystem}
              onChange={setIncludeSystem}
              style={{ width: '100%' }}
            >
              <Option value={true}>包含系统模板</Option>
              <Option value={false}>仅个人模板</Option>
            </Select>
          </Col>
          <Col span={8}>
            <Space>
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => handleEdit()}
              >
                新建模板
              </Button>
              <Button 
                icon={<SettingOutlined />}
                onClick={initializeSystemTemplates}
              >
                初始化系统模板
              </Button>
            </Space>
          </Col>
        </Row>

        {/* 模板列表 */}
        <Table
          dataSource={templates}
          columns={columns}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个模板`
          }}
          className="prompt-manager-table"
        />
      </Card>

      {/* 编辑模板对话框 */}
      <Modal
        title={currentTemplate ? '编辑模板' : '新建模板'}
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleSave}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input
            placeholder="模板名称"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
          />
          <Select
            placeholder="选择分类"
            value={formData.category}
            onChange={value => setFormData({ ...formData, category: value })}
            style={{ width: '100%' }}
          >
            {categories.map(category => (
              <Option key={category.value} value={category.value}>
                {category.label}
              </Option>
            ))}
          </Select>
          <TextArea
            placeholder="模板内容（使用 {{变量名}} 格式定义变量）"
            value={formData.template}
            onChange={e => setFormData({ ...formData, template: e.target.value })}
            rows={8}
          />
          <Input
            placeholder="模板描述"
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
          />
          <Input
            placeholder="变量定义（JSON数组格式，如: ['project_info', 'chapter_number']）"
            value={formData.variables}
            onChange={e => setFormData({ ...formData, variables: e.target.value })}
          />
          <Input
            placeholder="标签（逗号分隔）"
            value={formData.tags}
            onChange={e => setFormData({ ...formData, tags: e.target.value })}
          />
        </Space>
      </Modal>

      {/* 预览模板对话框 */}
      <Modal
        title="模板预览"
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setPreviewModalVisible(false)}>
            关闭
          </Button>,
          <Button key="use" type="primary" onClick={() => {
            if (currentTemplate) handleUseTemplate(currentTemplate);
            setPreviewModalVisible(false);
          }}>
            使用此模板
          </Button>
        ]}
      >
        {currentTemplate && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <strong>模板名称：</strong>{currentTemplate.name}
            </div>
            <div>
              <strong>分类：</strong>{categories.find(c => c.value === currentTemplate.category)?.label || currentTemplate.category}
            </div>
            {currentTemplate.description && (
              <div>
                <strong>描述：</strong>{currentTemplate.description}
              </div>
            )}
            <div>
              <strong>原始模板：</strong>
              <TextArea
                value={currentTemplate.template}
                rows={6}
                readOnly
                style={{ marginTop: 8 }}
              />
            </div>
            {previewData.missing_variables.length > 0 && (
              <div>
                <strong>需要的变量：</strong>
                {previewData.missing_variables.map(variable => (
                  <Tag key={variable} color="orange">{variable}</Tag>
                ))}
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default PromptManager;