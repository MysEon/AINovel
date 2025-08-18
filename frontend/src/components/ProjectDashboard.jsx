import React, { useState, useEffect } from 'react';
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
  MoreOutlined
} from '@ant-design/icons';
import { useNotification } from './NotificationManager';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const ProjectDashboard = ({ user, projects, onSelectProject, onCreateProject, onDeleteProject, onLogout }) => {
  const [form] = Form.useForm();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showConfirmDialog } = useNotification();

  useEffect(() => {
    if (!document.body.className.includes('-theme')) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.body.className = prefersDark ? 'dark-theme' : 'light-theme';
    }
  }, []);

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
        className="project-card"
        actions={[
          <Button 
            type="primary" 
            onClick={() => onSelectProject(project.id)}
            className="open-project-btn"
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
              className="project-menu-btn"
            />
          </Dropdown>
        }
      >
        <div className="project-header">
          <Title level={4} className="project-title">{project.name}</Title>
        </div>
        
        {project.description && (
          <Paragraph className="project-description" ellipsis={{ rows: 2 }}>
            {project.description}
          </Paragraph>
        )}
        
        <div className="project-stats">
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
        
        <div className="project-footer">
          <Space>
            <CalendarOutlined className="footer-icon" />
            <Text type="secondary" className="update-text">
              更新于 {formatDate(stats.lastUpdated)}
            </Text>
          </Space>
        </div>
      </Card>
    );
  };

  return (
    <div className="dashboard-container">
      {/* 头部区域 */}
      <div className="dashboard-header">
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
              className="create-project-btn"
              size="large"
            >
              新建项目
            </Button>
            
            <Dropdown
              menu={{ items: userMenuItems }}
              trigger={['click']}
              placement="bottomRight"
            >
              <div className="user-menu">
                <Avatar 
                  src={user?.avatar} 
                  icon={<UserOutlined />}
                  className="user-avatar"
                />
                <Text className="username">{user?.name || user?.username || '用户'}</Text>
              </div>
            </Dropdown>
          </div>
        </div>
      </div>

      {/* 项目网格 */}
      <div className="projects-content">
        {projects.length === 0 ? (
          <div className="empty-state">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div className="empty-content">
                  <Title level={4} className="empty-title">还没有项目</Title>
                  <Paragraph className="empty-description">
                    创建您的第一个小说项目，开始您的创作之旅
                  </Paragraph>
                </div>
              }
            >
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setShowCreateModal(true)}
                size="large"
                className="create-first-project-btn"
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
        className="create-project-modal"
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
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input 
              placeholder="输入项目名称" 
              size="large"
              className="form-input"
            />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="项目描述"
          >
            <TextArea
              placeholder="简要描述您的小说项目（可选）"
              rows={3}
              className="form-textarea"
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
                className="cancel-btn"
              >
                取消
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={loading}
                size="large"
                className="submit-btn"
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