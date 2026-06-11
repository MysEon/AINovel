import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentUser, logout as authLogout } from '../services/authService';
import { getToken, setToken, clearToken, STORAGE_KEYS } from '../services/core/authStorage';
import { onUnauthorized } from '../services/core/apiClient';
import { createProject as createProjectAPI, getUserProjects, deleteProject, getProject } from '../services/projectService';
import { useNotification } from '../components/NotificationManager';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRestoring, setIsRestoring] = useState(true);
  const { addNotification } = useNotification();
  const initialized = useRef(false);

  // 验证项目是否有效
  const validateProject = async (project) => {
    if (!project || !project.id) return null;
    try {
      return await getProject(project.id);
    } catch (error) {
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

  // 获取用户的所有项目
  const fetchProjects = useCallback(async () => {
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
  }, [addNotification]);

  // 登出处理
  const logout = useCallback(() => {
    setUser(null);
    setIsRestoring(false);
    setIsInitializing(false);
    authLogout();
  }, []);

  // 增强的初始化逻辑
  const initializeApp = useCallback(async (token) => {
    setIsInitializing(true);
    setIsRestoring(true);

    try {
      const userData = await validateToken(token);

      if (!userData) {
        logout();
        return false;
      }

      setUser(userData);

      // 如果是临时用户（网络错误情况），跳过项目获取
      if (userData.is_temp) {
        return true;
      }

      await fetchProjects();
      return true;
    } catch (error) {
      console.error('App initialization failed:', error);
      setUser(null);
      clearToken();
      setIsInitializing(false);
      setIsRestoring(false);
      return false;
    } finally {
      setIsInitializing(false);
      setIsRestoring(false);
    }
  }, [logout, fetchProjects]);

  // 登录处理
  const login = useCallback(async (token) => {
    setToken(token);
    return initializeApp(token);
  }, [initializeApp]);

  // 创建项目
  const createProject = useCallback(async (projectData) => {
    try {
      const newProject = await createProjectAPI(projectData);
      setProjects((prev) => [...prev, newProject]);
      addNotification({
        message: `项目 "${newProject.name}" 创建成功！`,
        type: 'success',
        duration: 3000
      });
      return newProject;
    } catch (error) {
      console.error('Failed to create project', error);
      addNotification({
        message: error.message || '创建项目失败',
        type: 'error',
        duration: 3000
      });
      throw error;
    }
  }, [addNotification]);

  // 删除项目
  const removeProject = useCallback(async (projectId) => {
    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      return true;
    } catch (error) {
      console.error('删除项目失败:', error);
      throw error;
    }
  }, []);

  // 初始化时检查本地存储的用户信息
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // 注册全局 401 回调 — apiClient 遇到 401 时自动触发登出
    onUnauthorized(() => logout());

    const savedToken = getToken();
    if (savedToken) {
      setTimeout(() => {
        initializeApp(savedToken).catch((error) => {
          console.error('Critical initialization error:', error);
          setIsInitializing(false);
          setIsRestoring(false);
          setUser(null);
          clearToken();
        });
      }, 100);
    } else {
      setIsInitializing(false);
      setIsRestoring(false);
    }
  }, [initializeApp, logout]);

  const value = {
    user,
    projects,
    isInitializing,
    isRestoring,
    login,
    logout,
    createProject,
    deleteProject: removeProject,
    fetchProjects,
    validateProject,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
