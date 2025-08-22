// 项目相关的API服务
const API_BASE_URL = '/api';

// 获取认证头
const getAuthHeaders = () => {
  let token = localStorage.getItem('ainovel_token');
  
  // 清理token中可能存在的引号包装
  if (token && typeof token === 'string') {
    // 移除可能存在的双引号包装
    token = token.replace(/^"|"$/g, '');
  }
  
  console.log('projectService: Getting auth headers, token exists:', !!token);
  if (token) {
    console.log('projectService: Token preview (cleaned):', token.substring(0, 20) + '...');
  }
  
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
  const url = `${API_BASE_URL}/projects/`;
  console.log('projectService: Making request to:', url);
  console.log('projectService: Request headers:', getAuthHeaders());
  
  const response = await fetch(url, {
    headers: getAuthHeaders()
  });

  console.log('projectService: Response status:', response.status);
  console.log('projectService: Response ok:', response.ok);
  
  if (!response.ok) {
    let errorMessage;
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || '获取项目列表失败';
    } catch (e) {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    console.error('projectService: Request failed:', errorMessage);
    
    if (response.status === 401) {
      errorMessage = 'Not authenticated';
    }
    
    throw new Error(errorMessage);
  }

  const result = await response.json();
  console.log('projectService: Success response:', result);
  return result;
};

// 获取单个项目
export const getProject = async (projectId) => {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/`, {
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
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/`, {
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
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || '删除项目失败');
  }

  return await response.json();
};