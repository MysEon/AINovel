import React, { useState } from 'react';
import { 
  Card, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Typography, 
  Avatar, 
  Dropdown, 
  Empty,
  Row,
  Col,
  Statistic,
  Space,
  Tag
} from 'antd';
import { 
  PlusOutlined, 
  BookOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  CalendarOutlined,
  UserOutlined,
  LogoutOutlined,
  MoreOutlined,
  SunOutlined,
  MoonOutlined
} from '@ant-design/icons';
import { useNotification } from './NotificationManager';
import { useTheme } from './ThemeProvider';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const ProjectDashboard = ({ user, projects, onSelectProject, onCreateProject, onDeleteProject, onLogout }) => {
  const [form] = Form.useForm();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showConfirmDialog } = useNotification();
  const { isDarkMode, toggleTheme } = useTheme();

  const handleCreateProject = async (values) => {
    setLoading(true);
    try {
      await onCreateProject({
        name: values.name,
        description: values.description || ''
      });
      form.resetFields();
      setShowCreateModal(false);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getProjectStats = (project) => {
    return {
      wordCount: project.word_count || 0,
      chapters: project.chapter_count || 0,
      lastUpdated: project.updated_at || project.created_at
    };
  };

  const userMenuItems = [
    {
      key: 'theme',
      icon: isDarkMode ? <SunOutlined /> : <MoonOutlined />,
      label: isDarkMode ? '切换至亮色主题' : '切换至暗色主题',
      onClick: toggleTheme
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: onLogout
    }
  ];

  const projectCardMenu = (project) => [
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: '编辑项目',
      onClick: () => onSelectProject(project.id)
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除项目',
      onClick: () => {
        showConfirmDialog({
          title: '删除项目',
          message: `您确定要删除项目 "${project.name}" 吗？此操作无法撤销。`,
          content: (
            <div style={{ marginTop: '12px' }}>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                请输入项目名称 <strong style={{ color: '#ff4d4f' }}>{project.name}</strong> 以确认删除：
              </p>
            </div>
          ),
          type: 'error',
          confirmText: '确认删除',
          showInput: true,
          expectedValue: project.name,
          inputPlaceholder: `请输入: ${project.name}`,
          required: true,
          showResultNotification: true,
          successMessage: '项目删除成功',
          errorMessage: '删除项目失败',
          onConfirm: (inputValue) => {
            if (inputValue === project.name) {
              return onDeleteProject(project.id);
            } else {
              throw new Error('项目名称不匹配，删除已取消');
            }
          }
        });
      },
      danger: true
    }
  ];

  const ProjectCard = ({ project }) => {
    const stats = getProjectStats(project);
    
    return (
      <Card
        style={{
          borderRadius: 12,
          border: `1px solid ${isDarkMode ? '#404040' : '#e0e0e0'}`,
          background: isDarkMode ? '#2d2d2d' : '#ffffff',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          height: '100%',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
        }}
        actions={[
          <Button 
            type="primary" 
            onClick={() => onSelectProject(project.id)}
            style={{
              borderRadius: 6,
              height: 36,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              fontSize: '0.9rem'
            }}
          >
            打开项目
          </Button>
        ]}
        extra={
          <Dropdown
            menu={{ items: projectCardMenu(project) }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button 
              type="text" 
              icon={<MoreOutlined />}
              style={{
                color: isDarkMode ? '#cccccc' : '#666',
                borderRadius: 6,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                fontSize: '14px',
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid transparent'
              }}
            />
          </Dropdown>
        }
      >
        <div style={{ marginBottom: '0.75rem', padding: '0 2px' }}>
          <Title level={4} style={{ 
            color: isDarkMode ? '#ffffff' : '#1a1a1a',
            margin: 0,
            fontWeight: 600,
            fontSize: '1.1rem',
            lineHeight: 1.2
          }}>{project.name}</Title>
        </div>
        
        {project.description && (
          <Paragraph style={{ 
            color: isDarkMode ? '#cccccc' : '#666',
            marginBottom: '1rem',
            fontSize: '0.9rem',
            lineHeight: 1.4,
            minHeight: '2.1rem',
            padding: '0 2px'
          }} ellipsis={{ rows: 2 }}>
            {project.description}
          </Paragraph>
        )}
        
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem 1rem',
          background: isDarkMode ? '#3d3d3d' : '#f8f9fa',
          borderRadius: 8,
          border: `1px solid ${isDarkMode ? '#505050' : '#e0e0e0'}`
        }}>
          <Row gutter={16}>
            <Col span={12}>
              <Statistic
                title="字数"
                value={stats.wordCount}
                suffix="字"
                valueStyle={{ fontSize: '16px', fontWeight: 600 }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="章节"
                value={stats.chapters}
                suffix="章"
                valueStyle={{ fontSize: '16px', fontWeight: 600 }}
              />
            </Col>
          </Row>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '0.75rem',
          borderTop: `1px solid ${isDarkMode ? '#404040' : 'rgba(0, 0, 0, 0.06)'}`,
          marginTop: '0.5rem'
        }}>
          <Space>
            <CalendarOutlined style={{ color: isDarkMode ? '#cccccc' : '#999', fontSize: '0.9rem' }} />
            <Text style={{ 
              color: isDarkMode ? '#cccccc' : '#666',
              fontSize: '0.85rem'
            }}>
              更新于 {formatDate(stats.lastUpdated)}
            </Text>
          </Space>
        </div>
      </Card>
    );
  };

  return (
    <div className="dashboard-container" style={{ 
      minHeight: '100vh',
      background: isDarkMode ? '#1a1a1a' : '#f5f5f5'
    }}>
      {/* 头部区域 */}
      <div className="dashboard-header" style={{
        padding: '2rem 2rem 1rem',
        background: isDarkMode ? '#2d2d2d' : '#ffffff',
        borderBottom: `1px solid ${isDarkMode ? '#404040' : '#e0e0e0'}`
      }}>
        <div className="header-content">
          <div className="header-left">
            <Title level={2} className="dashboard-title">
              我的项目
            </Title>
            <Paragraph className="welcome-text">
              欢迎回来，{user?.name || user?.username || '用户'}
            </Paragraph>
          </div>
          
          <div className="header-right">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowCreateModal(true)}
              size="large"
              style={{
                borderRadius: 8,
                height: 48,
                fontWeight: 600
              }}
            >
              新建项目
            </Button>
            
            <Dropdown
              menu={{ items: userMenuItems }}
              trigger={['click']}
              placement="bottomRight"
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 1rem',
                background: isDarkMode ? '#2d2d2d' : '#f8f9fa',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: `1px solid ${isDarkMode ? '#404040' : '#e0e0e0'}`
              }}>
                <Avatar 
                  src={user?.avatar} 
                  icon={<UserOutlined />}
                  style={{
                    background: isDarkMode ? '#ffffff' : '#1a1a1a',
                    border: `2px solid ${isDarkMode ? '#404040' : '#e0e0e0'}`
                  }}
                />
                <Text style={{
                  color: isDarkMode ? '#ffffff' : '#1a1a1a',
                  fontWeight: 500,
                  fontSize: '0.95rem'
                }}>{user?.name || user?.username || '用户'}</Text>
              </div>
            </Dropdown>
          </div>
        </div>
      </div>

      {/* 项目网格 */}
      <div style={{
        padding: '2rem',
        maxWidth: 1400,
        margin: '0 auto'
      }}>
        {projects.length === 0 ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 400
          }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <Title level={4} style={{ 
                    color: isDarkMode ? '#ffffff' : '#1a1a1a',
                    margin: '0 0 1rem 0',
                    fontWeight: 600
                  }}>还没有项目</Title>
                  <Paragraph style={{ 
                    color: isDarkMode ? '#cccccc' : '#666',
                    margin: 0,
                    fontSize: '1rem',
                    maxWidth: 400,
                    lineHeight: 1.6
                  }}>
                    创建您的第一个小说项目，开始您的创作之旅
                  </Paragraph>
                </div>
              }
            >
              <Button
                type="primary"
                onClick={() => setShowCreateModal(true)}
                size="large"
                style={{
                  borderRadius: 8,
                  height: 48,
                  fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                }}
              >
                创建项目
              </Button>
            </Empty>
          </div>
        ) : (
          <Row gutter={[24, 24]} className="projects-grid">
            {projects.map(project => (
              <Col xs={24} sm={24} md={12} lg={8} xl={6} key={project.id}>
                <ProjectCard project={project} />
              </Col>
            ))}
          </Row>
        )}
      </div>

      {/* 创建项目模态框 */}
      <Modal
        title="创建新项目"
        open={showCreateModal}
        onCancel={() => {
          setShowCreateModal(false);
          form.resetFields();
        }}
        footer={null}
        width={520}
        styles={{
          content: {
            borderRadius: 16,
            background: isDarkMode ? '#2d2d2d' : '#ffffff',
            border: `1px solid ${isDarkMode ? '#404040' : 'rgba(255, 255, 255, 0.2)'}`
          },
          header: {
            borderBottom: `1px solid ${isDarkMode ? '#404040' : 'rgba(0, 0, 0, 0.06)'}`,
            borderRadius: '16px 16px 0 0',
            background: 'transparent'
          }
        }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateProject}
          className="create-project-form"
        >
          <Form.Item
            name="name"
            label="项目名称"
            rules={[
              { required: true, message: '请输入项目名称' },
              {
                validator: (_, value) => {
                  if (projects.find(p => p.name === value)) {
                    return Promise.reject(new Error('项目名称已存在'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input 
              placeholder="输入项目名称" 
              size="large"
              style={{
                borderRadius: 8,
                border: `1px solid ${isDarkMode ? '#505050' : '#e0e0e0'}`,
                transition: 'all 0.3s ease'
              }}
            />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="项目描述"
          >
            <TextArea
              placeholder="简要描述您的小说项目（可选）"
              rows={3}
              style={{
                borderRadius: 8,
                border: `1px solid ${isDarkMode ? '#505050' : '#e0e0e0'}`,
                transition: 'all 0.3s ease'
              }}
            />
          </Form.Item>
          
          <Form.Item className="form-actions">
            <Space>
              <Button 
                onClick={() => {
                  setShowCreateModal(false);
                  form.resetFields();
                }}
                size="large"
                style={{
                  borderRadius: 8,
                  border: `1px solid ${isDarkMode ? '#505050' : '#e0e0e0'}`,
                  color: isDarkMode ? '#cccccc' : '#666',
                  fontWeight: 500,
                  height: 44,
                  transition: 'all 0.3s ease',
                  background: isDarkMode ? '#3d3d3d' : 'transparent'
                }}
              >
                取消
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={loading}
                size="large"
                style={{
                  borderRadius: 8,
                  fontWeight: 600,
                  height: 44,
                  transition: 'all 0.3s ease'
                }}
              >
                创建项目
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectDashboard;