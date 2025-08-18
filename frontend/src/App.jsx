import { useState, useEffect } from 'react';
import AuthPage from './components/AuthPage';
import ProjectDashboard from './components/ProjectDashboard';
import ProjectEditor from './components/ProjectEditor';
import { NotificationProvider, useNotification } from './components/NotificationManager';
import { createProject as createProjectAPI, getUserProjects, deleteProject } from './services/projectService';
import './App.css';

function AppContent() {
  // 应用状态
  const [currentView, setCurrentView] = useState('auth'); // 'auth' | 'dashboard' | 'editor'
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  
  const { addNotification, showConfirmDialog } = useNotification();

  const fetchCurrentUser = async (token) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        // 获取用户的项目数据
        await fetchUserProjects();
        setCurrentView('dashboard');
      } else {
        handleLogout();
      }
    } catch (error) {
      console.error('Failed to fetch user', error);
      handleLogout();
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
      fetchCurrentUser(savedToken);
    }
  }, []);

      // 用户信息通过token获取，不再直接本地存储user对象

  // 登录处理
  const handleLogin = (token) => {
    localStorage.setItem('ainovel_token', token);
    fetchCurrentUser(token);
  };

  // 登出处理
  const handleLogout = () => {
    setUser(null);
    setCurrentProject(null);
    setCurrentView('auth');
    localStorage.removeItem('ainovel_user');
    localStorage.removeItem('ainovel_token');
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
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
}

export default App;