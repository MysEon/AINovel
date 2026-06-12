import React, { useState } from 'react';
// Note: antd icons does not have a brush icon; EditOutlined used as fallback
import { useNavigate } from 'react-router-dom';
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
  Space
} from 'antd';
import {
  PlusOutlined,
  BookOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  LogoutOutlined,
  MoreOutlined,
  SunOutlined,
  MoonOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useNotification } from './NotificationManager';
import { useTheme } from './ThemeProvider';
import { useAuth } from '../contexts/AuthContext';
import './ProjectDashboard.css';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const ProjectDashboard = () => {
  const navigate = useNavigate();
  const { user, projects, createProject, deleteProject, logout } = useAuth();
  const [form] = Form.useForm();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showConfirmDialog } = useNotification();
  const { isDarkMode, toggleTheme } = useTheme();

  // 如果是临时用户（网络错误情况），显示提示信息
  if (user?.is_temp) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-5 text-center bg-background">
        <div className="text-6xl mb-5 opacity-30">
          🌐
        </div>
        <Title level={2} className="mb-4">
          网络连接问题
        </Title>
        <Paragraph className="mb-6 text-muted-foreground">
          无法连接到服务器，但您的登录状态已保存。请检查网络连接后刷新页面。
        </Paragraph>
        <Space>
          <Button type="primary" onClick={() => window.location.reload()}>
            刷新页面
          </Button>
          <Button onClick={logout}>
            重新登录
          </Button>
        </Space>
      </div>
    );
  }

  const handleCreateProject = async (values) => {
    setLoading(true);
    try {
      await createProject({
        name: values.name,
        description: values.description || ''
      });
      form.resetFields();
      setShowCreateModal(false);
    } finally {
      setLoading(false);
    }
  };

  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);

    if (diffSec < 60) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    if (diffHour < 24) return `${diffHour} 小时前`;
    if (diffDay < 30) return `${diffDay} 天前`;
    if (diffMonth < 12) return `${diffMonth} 个月前`;
    return `${diffYear} 年前`;
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
      icon: isDarkMode ? <MoonOutlined /> : <SunOutlined />,
      label: '切换主题模式',
      onClick: toggleTheme
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: logout
    }
  ];

  const projectCardMenu = (project) => [
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: '编辑项目',
      onClick: () => navigate(`/project/${project.id}`)
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
            <div className="mt-3">
              <p className="text-sm text-muted-foreground mb-2">
                请输入项目名称 <strong className="text-error">{project.name}</strong> 以确认删除：
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
              return deleteProject(project.id);
            } else {
              throw new Error('项目名称不匹配，删除已取消');
            }
          }
        });
      },
      danger: true
    }
  ];

  const ProjectCard = ({ project, index }) => {
    const stats = getProjectStats(project);

    return (
      <Card
        className="project-card"
        data-card-index={index % 6}
        actions={[
          <Button
            type="text"
            onClick={() => navigate(`/project/${project.id}`)}
            className="open-project-btn"
          >
            打开
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
        <div className="mb-3 px-0.5">
          <Title level={4} className="project-title">
            {project.name}
          </Title>
        </div>

        {project.description && (
          <Paragraph className="project-description" ellipsis={{ rows: 2 }}>
            {project.description}
          </Paragraph>
        )}

        <div className="project-stats">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <EditOutlined className="text-primary text-sm" />
              <span className="text-sm font-semibold text-foreground">{stats.wordCount}</span>
              <span className="text-xs text-muted-foreground">字</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <BookOutlined className="text-primary text-sm" />
              <span className="text-sm font-semibold text-foreground">{stats.chapters}</span>
              <span className="text-xs text-muted-foreground">章</span>
            </div>
          </div>
        </div>

        <div className="project-footer">
          <Space>
            <ClockCircleOutlined className="text-muted-foreground text-sm" />
            <Text className="text-xs text-muted-foreground">
              {formatRelativeTime(stats.lastUpdated)}
            </Text>
          </Space>
        </div>
      </Card>
    );
  };

  return (
    <div className="dashboard-container bg-background min-h-screen">
      {/* 头部区域 */}
      <div className="dashboard-header bg-card border-b border-border">
        <div className="header-content">
          <div className="header-left">
            <Title level={2} className="dashboard-title">
              我的项目
            </Title>
            <Paragraph className="welcome-text">
              欢迎回到书案，{user?.name || user?.username || '用户'}
            </Paragraph>
          </div>

          <div className="header-right">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowCreateModal(true)}
              size="large"
              className="create-project-btn"
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
                <Text className="username">
                  {user?.name || user?.username || '用户'}
                </Text>
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
                <div className="text-center mb-8">
                  <Title level={4} className="empty-title">
                    白纸一张
                  </Title>
                  <Paragraph className="empty-description">
                    创建您的第一个小说项目，开始您的创作之旅
                  </Paragraph>
                </div>
              }
            >
              <Button
                type="primary"
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
            {projects.filter(p => p.user_id === user?.id).map((project, index) => (
              <Col xs={24} sm={24} md={12} lg={8} xl={6} key={project.id}>
                <ProjectCard project={project} index={index} />
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
