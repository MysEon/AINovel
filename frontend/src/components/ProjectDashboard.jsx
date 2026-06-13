import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Button,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Space,
  Typography,
} from 'antd';
import {
  AppstoreOutlined,
  BookOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  LogoutOutlined,
  MoreOutlined,
  MoonOutlined,
  PlusOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNotification } from './NotificationManager';
import { useTheme } from './ThemeProvider';
import { useAuth } from '../contexts/AuthContext';
import './ProjectDashboard.css';

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;

const ProjectDashboard = () => {
  const navigate = useNavigate();
  const { user, projects, createProject, deleteProject, logout } = useAuth();
  const [form] = Form.useForm();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showConfirmDialog } = useNotification();
  const { isDarkMode, toggleTheme } = useTheme();

  const visibleProjects = useMemo(
    () => projects.filter((project) => !project.user_id || project.user_id === user?.id),
    [projects, user?.id]
  );

  if (user?.is_temp) {
    return (
      <div className="dashboard-container dashboard-offline">
        <div className="offline-panel">
          <AppstoreOutlined />
          <Title level={2}>网络连接异常</Title>
          <Paragraph>当前无法连接服务器，但你的登录状态仍保存在本机。检查网络后刷新页面即可继续。</Paragraph>
          <Space>
            <Button type="primary" onClick={() => window.location.reload()}>
              刷新页面
            </Button>
            <Button onClick={logout}>重新登录</Button>
          </Space>
        </div>
      </div>
    );
  }

  const formatRelativeTime = (dateString) => {
    if (!dateString) return '刚刚更新';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffMonth = Math.floor(diffDay / 30);

    if (diffMin < 1) return '刚刚更新';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    if (diffHour < 24) return `${diffHour} 小时前`;
    if (diffDay < 30) return `${diffDay} 天前`;
    if (diffMonth < 12) return `${diffMonth} 个月前`;
    return `${Math.floor(diffDay / 365)} 年前`;
  };

  const handleCreateProject = async (values) => {
    setLoading(true);
    try {
      await createProject({
        name: values.name,
        description: values.description || '',
      });
      form.resetFields();
      setShowCreateModal(false);
    } finally {
      setLoading(false);
    }
  };

  const projectCardMenu = (project) => [
    {
      key: 'open',
      icon: <EditOutlined />,
      label: '打开项目',
      onClick: () => navigate(`/project/${project.id}`),
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除项目',
      danger: true,
      onClick: () => {
        showConfirmDialog({
          title: '删除项目',
          message: `确定删除「${project.name}」吗？此操作无法撤销。`,
          type: 'error',
          confirmText: '确认删除',
          showInput: true,
          expectedValue: project.name,
          inputPlaceholder: `输入 ${project.name}`,
          required: true,
          showResultNotification: true,
          successMessage: '项目已删除',
          errorMessage: '删除项目失败',
          onConfirm: (inputValue) => {
            if (inputValue === project.name) return deleteProject(project.id);
            throw new Error('项目名称不匹配，已取消删除');
          },
        });
      },
    },
  ];

  const userMenuItems = [
    {
      key: 'theme',
      icon: isDarkMode ? <MoonOutlined /> : <SunOutlined />,
      label: isDarkMode ? '切换到亮色' : '切换到暗色',
      onClick: toggleTheme,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: logout,
    },
  ];

  const ProjectCard = ({ project }) => {
    const wordCount = project.word_count || 0;
    const chapterCount = project.chapter_count || 0;
    const updatedAt = project.updated_at || project.created_at;

    return (
      <article className="project-card">
        <div className="project-card-top">
          <div className="project-mark">
            <BookOutlined />
          </div>
          <Dropdown menu={{ items: projectCardMenu(project) }} trigger={['click']} placement="bottomRight">
            <Button type="text" icon={<MoreOutlined />} className="project-menu-btn" />
          </Dropdown>
        </div>

        <button className="project-card-main" type="button" onClick={() => navigate(`/project/${project.id}`)}>
          <h2>{project.name}</h2>
          <p>{project.description || '还没有简介。进入项目后可以继续完善设定和章节。'}</p>
        </button>

        <div className="project-card-meta">
          <span>
            <EditOutlined /> {wordCount.toLocaleString()} 字
          </span>
          <span>
            <BookOutlined /> {chapterCount} 章
          </span>
        </div>

        <div className="project-card-footer">
          <span>
            <ClockCircleOutlined /> {formatRelativeTime(updatedAt)}
          </span>
          <Button type="primary" onClick={() => navigate(`/project/${project.id}`)}>
            打开
          </Button>
        </div>
      </article>
    );
  };

  return (
    <main className="dashboard-container">
      <header className="dashboard-header">
        <div className="dashboard-title-group">
          <span className="dashboard-kicker">Workspace</span>
          <Title level={1}>项目</Title>
          <Paragraph>管理你的小说项目、设定资产和 AI 写作流程。</Paragraph>
        </div>

        <div className="dashboard-actions">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreateModal(true)}>
            新建项目
          </Button>
          <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
            <button className="user-menu" type="button">
              <Avatar src={user?.avatar} icon={<UserOutlined />} className="user-avatar" />
              <span>{user?.name || user?.username || '用户'}</span>
            </button>
          </Dropdown>
        </div>
      </header>

      <section className="dashboard-summary" aria-label="项目概览">
        <div>
          <strong>{visibleProjects.length}</strong>
          <span>项目</span>
        </div>
        <div>
          <strong>{visibleProjects.reduce((sum, project) => sum + (project.chapter_count || 0), 0)}</strong>
          <span>章节</span>
        </div>
        <div>
          <strong>{visibleProjects.reduce((sum, project) => sum + (project.word_count || 0), 0).toLocaleString()}</strong>
          <span>总字数</span>
        </div>
      </section>

      <section className="projects-content">
        {visibleProjects.length === 0 ? (
          <div className="empty-state">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div className="empty-copy">
                  <Title level={3}>还没有项目</Title>
                  <Paragraph>创建第一个项目，把章节、设定、提示词和 AI 流程收拢到同一个工作台。</Paragraph>
                </div>
              }
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreateModal(true)}>
                创建项目
              </Button>
            </Empty>
          </div>
        ) : (
          <div className="projects-grid">
            {visibleProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>

      <Modal
        title="新建项目"
        open={showCreateModal}
        onCancel={() => {
          setShowCreateModal(false);
          form.resetFields();
        }}
        footer={null}
        width={520}
        className="create-project-modal"
      >
        <Form form={form} layout="vertical" onFinish={handleCreateProject} className="create-project-form">
          <Form.Item
            name="name"
            label="项目名称"
            rules={[
              { required: true, message: '请输入项目名称' },
              {
                validator: (_, value) => {
                  if (visibleProjects.find((project) => project.name === value)) {
                    return Promise.reject(new Error('项目名称已存在'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input placeholder="例如：星海归途" size="large" />
          </Form.Item>

          <Form.Item name="description" label="项目简介">
            <TextArea placeholder="一句话描述这个项目的主题、风格或核心冲突" rows={3} />
          </Form.Item>

          <Form.Item className="form-actions">
            <Space>
              <Button
                onClick={() => {
                  setShowCreateModal(false);
                  form.resetFields();
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                创建项目
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </main>
  );
};

export default ProjectDashboard;
