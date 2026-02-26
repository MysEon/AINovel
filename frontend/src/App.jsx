import { useState, useEffect } from 'react';
import { App as AntdApp } from 'antd';
import AuthPage from './components/AuthPage';
import ProjectDashboard from './components/ProjectDashboard';
import ProjectEditor from './components/ProjectEditor';
import ErrorBoundary from './components/ErrorBoundary';
import { NotificationProvider, useNotification } from './components/NotificationManager';
import { createProject as createProjectAPI, getUserProjects, deleteProject, getProject } from './services/projectService';
import { getCurrentUser } from './services/authService';
import { getToken } from './services/core/authStorage';
import usePersistentState from './hooks/usePersistentState';
import storageHealthCheck from './utils/storageHealthCheck';
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
    if (!project || !project.id) {
      console.log('No project to validate');
      return null;
    }
    
    try {
      console.log('Validating project:', project.id);
      const validProject = await getProject(project.id);
      console.log('Project validation successful:', validProject);
      return validProject;
    } catch (error) {
      console.warn(`Project ${project.id} is no longer accessible:`, error);
      // 项目不存在或无权限访问，清除持久化状态
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
    console.log('=== Starting app initialization ===');
    console.log('Token preview:', token ? token.substring(0, 20) + '...' : 'null');
    setIsInitializing(true);
    setIsRestoring(true);
    
    try {
      // 验证Token
      console.log('Step 1: Validating token...');
      const userData = await validateToken(token);
      
      if (!userData) {
        console.log('Token validation failed, redirecting to login');
        handleLogout();
        return;
      }
      
      console.log('Step 2: Token validated successfully, setting user data');
      setUser(userData);
      
      // 如果是临时用户（网络错误情况），跳过项目获取
      if (userData.is_temp) {
        console.log('Using temporary user due to network issues, skipping project fetch');
        setCurrentView('dashboard');
        console.log('=== App initialization completed with temporary user ===');
        return;
      }
      
      // 获取用户的项目数据
      console.log('Step 3: Fetching user projects...');
      await fetchUserProjects();
      
      // 检查是否需要恢复编辑器状态
      console.log('Step 4: Checking editor state restoration...');
      if (currentView === 'editor' && currentProject) {
        console.log('Attempting to restore editor state for project:', currentProject);
        const validProject = await validateProject(currentProject);
        
        if (validProject) {
          console.log('Project validated, restoring editor view');
          setCurrentProject(validProject);
          setCurrentView('editor');
        } else {
          console.log('Project validation failed, falling back to dashboard');
          setCurrentProject(null);
          setCurrentView('dashboard');
        }
      } else {
        // 默认到仪表板
        console.log('No editor state to restore, going to dashboard');
        setCurrentView('dashboard');
      }
      
      console.log('=== App initialization completed successfully ===');
    } catch (error) {
      console.error('=== App initialization failed ===', error);
      // 确保在任何错误情况下都能恢复到可用状态
      setCurrentProject(null);
      setCurrentView('auth');
      setUser(null);
      // 不调用 handleLogout，避免清除token导致无限循环
      localStorage.removeItem('ainovel_token');
    } finally {
      // 确保状态始终被重置
      setIsInitializing(false);
      setIsRestoring(false);
      console.log('=== App initialization process finished ===');
    }
  };

  // 获取项目的所有项目
  const fetchUserProjects = async () => {
    try {
      console.log('App: Starting to fetch user projects...');
      const userProjects = await getUserProjects();
      console.log('App: Successfully fetched projects:', userProjects);
      setProjects(userProjects);
    } catch (error) {
      console.error('App: Failed to fetch projects', error);
      addNotification({
        message: '获取项目列表失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
    }
  };

  // 初始化时检查本地存储的用户信息
  useEffect(() => {
    console.log('App useEffect triggered, performing storage health check...');
    
    // 先进行存储健康检查
    try {
      const healthCheckResult = storageHealthCheck.performStorageHealthCheck();
      if (healthCheckResult.repair.corrupted > 0) {
        console.warn(`Fixed ${healthCheckResult.repair.repaired} corrupted localStorage items`);
      }
    } catch (error) {
      console.error('Storage health check failed:', error);
      // 即使健康检查失败，也要继续应用初始化
    }
    
    console.log('Checking for saved token...');
    let savedToken = null;
    
    // 尝试从多个存储位置获取token
    try {
      // 方式1：从storageHealthCheck获取
      savedToken = storageHealthCheck.safeGetLocalStorage('ainovel_token');
      
      // 方式2：从备份位置获取
      if (!savedToken) {
        savedToken = localStorage.getItem('ainovel_token_backup');
        if (savedToken) {
          console.log('Found token in backup storage');
          // 恢复到主存储位置
          storageHealthCheck.safeSetLocalStorage('ainovel_token', savedToken);
        }
      }
      
      // 方式3：从sessionStorage获取
      if (!savedToken) {
        savedToken = sessionStorage.getItem('ainovel_token');
        if (savedToken) {
          console.log('Found token in session storage');
          // 恢复到主存储位置
          storageHealthCheck.safeSetLocalStorage('ainovel_token', savedToken);
        }
      }
    } catch (error) {
      console.error('Error retrieving token from storage:', error);
    }
    
    if (savedToken) {
      console.log('Found saved token, initializing app...');
      // 使用 setTimeout 确保状态更新不会被阻塞
      setTimeout(() => {
        initializeApp(savedToken).catch((error) => {
          console.error('Critical initialization error:', error);
          // 出现严重错误时，强制重置到登录页
          setIsInitializing(false);
          setIsRestoring(false);
          setCurrentView('auth');
          setUser(null);
          setCurrentProject(null);
          localStorage.removeItem('ainovel_token');
        });
      }, 100);
    } else {
      console.log('No saved token found, going to auth page');
      // 没有 token，直接显示登录页
      setIsInitializing(false);
      setIsRestoring(false);
      setCurrentView('auth');
    }
  }, []);

      // 用户信息通过token获取，不再直接本地存储user对象

  // 登录处理
  const handleLogin = (token) => {
    // 确保 token 没有引号包装
    const cleanToken = typeof token === 'string' ? token.replace(/^"|"$/g, '') : token;
    console.log('handleLogin: Saving cleaned token:', cleanToken.substring(0, 20) + '...');
    
    // 使用多种方式保存token，确保至少有一种方式成功
    try {
      // 方式1：使用storageHealthCheck
      storageHealthCheck.safeSetLocalStorage('ainovel_token', cleanToken);
      
      // 方式2：直接保存作为备份
      localStorage.setItem('ainovel_token_backup', cleanToken);
      
      // 方式3：sessionStorage作为额外备份
      sessionStorage.setItem('ainovel_token', cleanToken);
      
      console.log('Token saved using multiple storage methods');
    } catch (error) {
      console.error('Error saving token to storage:', error);
      // 即使保存失败，也尝试继续初始化
    }
    
    initializeApp(cleanToken);
  };

  // 登出处理
  const handleLogout = () => {
    console.log('Handling logout...');
    setUser(null);
    setCurrentProject(null);
    setCurrentView('auth');
    setIsRestoring(false);
    setIsInitializing(false);
    
    // 使用安全的清理方法，清理所有存储位置
    const keysToRemove = ['ainovel_user', 'ainovel_token', 'ainovel_token_backup', 'ainovel_last_view', 'ainovel_current_project'];
    
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Failed to remove ${key} from localStorage:`, error);
      }
    });
    
    // 清理sessionStorage
    try {
      sessionStorage.removeItem('ainovel_token');
    } catch (error) {
      console.warn('Failed to remove token from sessionStorage:', error);
    }
    
    console.log('Logout completed');
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
                console.log('Manual reset triggered by user');
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