import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Outlet } from 'react-router-dom';
import Sidebar from '../Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../components/ThemeProvider';
import { FaSun, FaMoon, FaDesktop, FaArrowLeft } from 'react-icons/fa';
import { getProject } from '../services/projectService';
import { useNotification } from '../components/NotificationManager';

// 路由段落到菜单项标签的映射
const routeToMenuItem = {
  writing: '开始写作',
  worldbuilding: '角色管理',
  knowledge: '知识库总览',
  'ai-workflow': '对话生成',
  overview: '项目总览',
  kanban: '看板页',
  models: '模型参数选择',
  prompts: '提示词管理',
  published: '已发布',
};

// 菜单项标签到路由的映射
const menuItemToRoute = {
  '开始写作': 'writing',
  '章节管理': 'writing',
  '模型参数选择': 'models',
  '提示词管理': 'prompts',
  '知识库总览': 'knowledge',
  '角色管理': 'worldbuilding',
  '地点管理': 'worldbuilding',
  '组织管理': 'worldbuilding',
  '世界观管理': 'worldbuilding',
  '主线大纲': 'overview',
  '时间线': 'kanban',
  '对话生成': 'ai-workflow',
  '语言润色': 'ai-workflow',
  '情感分析': 'ai-workflow',
  '已发布': 'published',
  '历史版本': 'writing',
  '项目总览': 'overview',
  '进度追踪': 'kanban',
  '看板页': 'kanban',
};

const menuItems = {
  '开始写作': ['开始写作'],
  '项目管理': ['模型参数选择', '提示词管理'],
  '知识库': ['知识库总览', '角色管理', '地点管理', '组织管理', '世界观管理'],
  '剧情结构': ['主线大纲', '章节管理', '时间线'],
  '写作辅助': ['对话生成', '语言润色', '情感分析'],
  '创作库': ['已发布', '历史版本'],
  '项目看板': ['项目总览', '进度追踪', '看板页'],
};

const EditorLayout = () => {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { projects, fetchProjects } = useAuth();
  const { themeMode, effectiveMode, toggleTheme } = useTheme();
  const { addNotification } = useNotification();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [project, setProject] = useState(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);

  // 根据当前路由计算 activeItem
  const activeItem = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const routeSegment = segments[2]; // /project/:id/segment
    return routeToMenuItem[routeSegment] || '开始写作';
  }, [location.pathname]);

  // 获取或加载项目信息
  useEffect(() => {
    const numericId = parseInt(projectId, 10);
    const found = projects.find((p) => p.id === numericId);
    if (found) {
      setProject(found);
      return;
    }

    setIsLoadingProject(true);
    getProject(numericId)
      .then((data) => setProject(data))
      .catch(() => {
        addNotification({
          message: '加载项目信息失败',
          type: 'error',
          duration: 3000,
        });
        navigate('/dashboard');
      })
      .finally(() => setIsLoadingProject(false));
  }, [projectId, projects, navigate, addNotification]);

  // 侧边栏折叠
  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // 返回仪表盘
  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  // 菜单项点击处理
  const handleSetActiveItem = (item) => {
    const route = menuItemToRoute[item];
    if (route) {
      navigate(`/project/${projectId}/${route}`);
    } else {
      addNotification({
        message: '该功能正在开发中',
        type: 'info',
        duration: 2000,
      });
    }
  };

  // 获取主题图标和文本
  const getThemeInfo = () => {
    switch (themeMode) {
      case 'system':
        return { icon: <FaDesktop />, text: '跟随系统' };
      case 'light':
        return { icon: <FaSun />, text: '亮色模式' };
      case 'dark':
        return { icon: <FaMoon />, text: '暗色模式' };
      default:
        return { icon: <FaDesktop />, text: '跟随系统' };
    }
  };

  if (isLoadingProject) {
    return (
      <div className="loading-container">
        <div
          className="loading-spinner"
          style={{
            width: '40px',
            height: '40px',
            border: '4px solid var(--border-color)',
            borderTop: '4px solid var(--primary-color)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}
        />
        <div className="text-base text-center" style={{ color: 'var(--secondary-text-color)' }}>
          加载项目中...
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        menuItems={menuItems}
        activeItem={activeItem}
        setActiveItem={handleSetActiveItem}
        isCollapsed={isSidebarCollapsed}
        toggleSidebar={toggleSidebar}
        currentProject={parseInt(projectId, 10)}
        projects={project ? [project] : []}
        setCurrentProject={() => {}}
        onCreateProject={() => {}}
        hideProjectSelector={true}
        projectName={project?.name || '未知项目'}
        onBackToDashboard={handleBackToDashboard}
        hideBackButton={true}
      />
      <main className="content">
        <div className="content-actions">
          <button onClick={handleBackToDashboard} className="back-to-dashboard" title="返回项目列表">
            <FaArrowLeft />
            <span>返回项目列表</span>
          </button>
          <button onClick={toggleTheme} className="theme-toggle" title="切换主题模式">
            {getThemeInfo().icon}
            <span>{getThemeInfo().text}</span>
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
};

export default EditorLayout;
