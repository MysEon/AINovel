import { useState, useEffect } from 'react';
import { App as AntdApp } from 'antd';
import AuthPage from './components/AuthPage';
import ProjectDashboard from './components/ProjectDashboard';
import ProjectEditor from './components/ProjectEditor';
import ErrorBoundary from './components/ErrorBoundary';
import { NotificationProvider, useNotification } from './components/NotificationManager';
import { createProject as createProjectAPI, getUserProjects, deleteProject, getProject } from './services/projectService';
import { getCurrentUser, logout as authLogout } from './services/authService';
import { getToken, setToken, clearToken } from './services/core/authStorage';
import { onUnauthorized } from './services/core/apiClient';
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
      return await getProject(project.id);
    } catch (error) {
      setCurrentProject(null);
      return null;
    }
  };

  // 验证Token是否有效的辅助函数
  const validateToken = async (token) => {
    if (!token || typeof token !== 'string' || token.length < 10) {
      return false;
    }

    try {
      const userData = await getCurrentUser();
      return userData;
    } catch (error) {
      if (error.status === 401) {
        return false;
      }
      // 网络错误时保留登录状态
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        return { id: 'temp', username: 'temp_user', is_temp: true };
      }
      return false;
    }
  };

  // 增强的初始化逻辑
  const initializeApp = async (token) => {
    setIsInitializing(true);
    setIsRestoring(true);

    try {
      const userData = await validateToken(token);

      if (!userData) {
        handleLogout();
        return;
      }
      
      setUser(userData);

      // 如果是临时用户（网络错误情况），跳过项目获取
      if (userData.is_temp) {
        setCurrentView('dashboard');
        return;
      }

      await fetchUserProjects();

      // 检查是否需要恢复编辑器状态
      if (currentView === 'editor' && currentProject) {
        const validProject = await validateProject(currentProject);
        if (validProject) {
          setCurrentProject(validProject);
          setCurrentView('editor');
        } else {
          setCurrentProject(null);
          setCurrentView('dashboard');
        }
      } else {
        setCurrentView('dashboard');
      }
    } catch (error) {
      console.error('App initialization failed:', error);
      // 确保在任何错误情况下都能恢复到可用状态
      setCurrentProject(null);
      setCurrentView('auth');
      setUser(null);
      // 不调用 handleLogout，避免清除token导致无限循环
      clearToken();
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
      console.error('Failed to fetch projects:', error);
      addNotification({
        message: '获取项目列表失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
    }
  };

  // 初始化时检查本地存储的用户信息
  useEffect(() => {
    // 注册全局 401 回调 — apiClient 遇到 401 时自动触发登出
    onUnauthorized(() => handleLogout());

    const savedToken = getToken();
    if (savedToken) {
      setTimeout(() => {
        initializeApp(savedToken).catch((error) => {
          console.error('Critical initialization error:', error);
          setIsInitializing(false);
          setIsRestoring(false);
          setCurrentView('auth');
          setUser(null);
          setCurrentProject(null);
          clearToken();
        });
      }, 100);
    } else {
      setIsInitializing(false);
      setIsRestoring(false);
      setCurrentView('auth');
    }
  }, []);

      // 用户信息通过token获取，不再直接本地存储user对象

  // 登录处理
  const handleLogin = (token) => {
    setToken(token);
    initializeApp(token);
  };

  // 登出处理
  const handleLogout = () => {
    setUser(null);
    setCurrentProject(null);
    setCurrentView('auth');
    setIsRestoring(false);
    setIsInitializing(false);
    authLogout(); // clearToken + 清理本地状态
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
          gap: '20px',
          backgroundColor: '#ffffff',
          color: '#333'
        }}>
          <div className="loading-spinner" style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f0f0f0',
            borderTop: '4px solid #1890ff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <div style={{ color: '#666', fontSize: '16px', textAlign: 'center' }}>
            {isRestoring ? '正在恢复上次状态...' : '初始化中...'}
          </div>
          {/* 添加一个安全机制：如果加载时间过长，提供手动重置选项 */}
          <div style={{ marginTop: '20px' }}>
            <button 
              onClick={() => {
                setIsRestoring(false);
                setIsInitializing(false);
                setCurrentView('auth');
                setUser(null);
                setCurrentProject(null);
                localStorage.clear();
              }}
              style={{
                background: '#ff4d4f',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              重置应用
            </button>
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
    <ErrorBoundary>
      <AntdApp>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </AntdApp>
    </ErrorBoundary>
  );
}

export default App;