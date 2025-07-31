// 项目相关的API服务
const API_BASE_URL = '/api';

// 获取认证头
const getAuthHeaders = () => {
  const token = localStorage.getItem('ainovel_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

// 创建项目
export const createProject = async (projectData) => {
  const response = await fetch(`${API_BASE_URL}/projects/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(projectData)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || '创建项目失败');
  }

  return await response.json();
};

// 获取用户的所有项目
export const getUserProjects = async () => {
  const response = await fetch(`${API_BASE_URL}/projects/`, {
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || '获取项目列表失败');
  }

  return await response.json();
};

// 获取单个项目
export const getProject = async (projectId) => {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || '获取项目详情失败');
  }

  return await response.json();
};

// 更新项目
export const updateProject = async (projectId, projectData) => {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(projectData)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || '更新项目失败');
  }

  return await response.json();
};

// 删除项目
export const deleteProject = async (projectId) => {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || '删除项目失败');
  }

  return await response.json();
};