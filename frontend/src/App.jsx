import { useState, useEffect } from 'react';
import { App as AntdApp } from 'antd';
import AuthPage from './components/AuthPage';
import ProjectDashboard from './components/ProjectDashboard';
import ProjectEditor from './components/ProjectEditor';
import { NotificationProvider, useNotification } from './components/NotificationManager';
import { createProject as createProjectAPI, getUserProjects, deleteProject, getProject } from './services/projectService';
import usePersistentState from './hooks/usePersistentState';
import './App.css';

function AppContent() {
  // 应用状态（使用持久化状态）
  const [currentView, setCurrentView] = usePersistentState('ainovel_last_view', 'auth'); // 'auth' | 'dashboard' | 'editor'
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = usePersistentState('ainovel_current_project', null);
  const [isInitializing, setIsInitializing] = useState(true); // 初始为 true，避免闪烁
  const [isRestoring, setIsRestoring] = useState(true); // 新增：状态恢复中
  
  const { addNotification, showConfirmDialog } = useNotification();

  // 验证项目是否有效
  const validateProject = async (project) => {
    if (!project || !project.id) return null;
    
    try {
      const validProject = await getProject(project.id);
      return validProject;
    } catch (error) {
      console.warn(`Project ${project.id} is no longer accessible:`, error);
      // 项目不存在或无权限访问，清除持久化状态
      setCurrentProject(null);
      return null;
    }
  };

  // 增强的初始化逻辑
  const initializeApp = async (token) => {
    setIsInitializing(true);
    
    try {
      // 验证用户身份
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        handleLogout();
        return;
      }

      const userData = await response.json();
      setUser(userData);
      
      // 获取用户的项目数据
      await fetchUserProjects();
      
      // 检查是否需要恢复编辑器状态
      if (currentView === 'editor' && currentProject) {
        console.log('Attempting to restore editor state for project:', currentProject);
        const validProject = await validateProject(currentProject);
        
        if (validProject) {
          console.log('Project validated, restoring editor view');
          setCurrentProject(validProject);
          setCurrentView('editor');
        } else {
          console.log('Project validation failed, falling back to dashboard');
          setCurrentView('dashboard');
        }
      } else {
        // 默认到仪表板
        setCurrentView('dashboard');
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
      handleLogout();
    } finally {
      setIsInitializing(false);
      setIsRestoring(false);
    }
  };

  // 获取用户的所有项目
  const fetchUserProjects = async () => {
    try {
      const userProjects = await getUserProjects();
      setProjects(userProjects);
    } catch (error) {
      console.error('Failed to fetch projects', error);
      addNotification({
        message: '获取项目列表失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
    }
  };

  // 初始化时检查本地存储的用户信息
  useEffect(() => {
    const savedToken = localStorage.getItem('ainovel_token');
    if (savedToken) {
      initializeApp(savedToken);
    } else {
      // 没有 token，直接显示登录页
      setIsInitializing(false);
      setIsRestoring(false);
      setCurrentView('auth');
    }
  }, []);

      // 用户信息通过token获取，不再直接本地存储user对象

  // 登录处理
  const handleLogin = (token) => {
    localStorage.setItem('ainovel_token', token);
    initializeApp(token);
  };

  // 登出处理
  const handleLogout = () => {
    setUser(null);
    setCurrentProject(null);
    setCurrentView('auth');
    setIsRestoring(false);
    localStorage.removeItem('ainovel_user');
    localStorage.removeItem('ainovel_token');
    localStorage.removeItem('ainovel_last_view');
    localStorage.removeItem('ainovel_current_project');
  };

  // 创建项目
  const handleCreateProject = async (projectData) => {
    try {
      const newProject = await createProjectAPI(projectData);
      setProjects([...projects, newProject]);
      
      // 显示成功消息
      addNotification({
        message: `项目 "${newProject.name}" 创建成功！`,
        type: 'success',
        duration: 3000
      });
    } catch (error) {
      console.error('Failed to create project', error);
      // 显示错误消息
      addNotification({
        message: error.message || '创建项目失败',
        type: 'error',
        duration: 3000
      });
    }
  };

  // 选择项目进入编辑器
  const handleSelectProject = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setCurrentProject(project);
      setCurrentView('editor');
    }
  };

  // 删除项目
  const handleDeleteProject = async (projectId) => {
    try {
      await deleteProject(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
      if (currentProject && currentProject.id === projectId) {
        setCurrentProject(null);
        setCurrentView('dashboard');
      }
    } catch (error) {
      console.error('删除项目失败:', error);
    }
  };

  // 返回项目仪表板
  const handleBackToDashboard = () => {
    setCurrentProject(null);
    setCurrentView('dashboard');
  };

  // 渲染当前视图
  const renderCurrentView = () => {
    // 在状态恢复期间显示加载界面
    if (isRestoring || isInitializing) {
      return (
        <div className="loading-container" style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div className="loading-spinner" style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f0f0f0',
            borderTop: '4px solid #1890ff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <div style={{ color: '#666', fontSize: '16px' }}>
            {isRestoring ? '正在恢复上次状态...' : '初始化中...'}
          </div>
        </div>
      );
    }

    switch (currentView) {
      case 'auth':
        return <AuthPage onLogin={handleLogin} />;

      case 'dashboard':
        return (
          <ProjectDashboard 
            user={user}
            projects={projects.filter(p => p.user_id === user?.id)}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            onDeleteProject={handleDeleteProject}
            onLogout={handleLogout}
          />
        );
      
      case 'editor':
        return (
          <ProjectEditor 
            user={user}
            project={currentProject}
            onBackToDashboard={handleBackToDashboard}
            onProjectsChange={fetchUserProjects}
          />
        );
      
      default:
        return <AuthPage onLogin={handleLogin} />;
    }
  };

  return (
    <div className="app">
      {renderCurrentView()}
    </div>
  );
}

function App() {
  return (
    <AntdApp>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AntdApp>
  );
}

export default App;