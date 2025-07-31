// 章节相关的API服务
const API_BASE_URL = '/api';

// 获取认证头
const getAuthHeaders = () => {
  const token = localStorage.getItem('ainovel_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

// 创建章节
export const createChapter = async (projectId, chapterData) => {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/chapters`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(chapterData)
  });

  if (!response.ok) {
    // 尝试解析错误响应，如果失败则使用默认错误消息
    try {
      const errorData = await response.json();
      throw new Error(errorData.detail || '创建章节失败');
    } catch (e) {
      // 如果无法解析JSON，使用响应文本或默认错误消息
      const errorText = await response.text();
      throw new Error(errorText || '创建章节失败: 服务器返回错误');
    }
  }

  return await response.json();
};

// 获取项目的所有章节
export const getChapters = async (projectId) => {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/chapters`, {
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    // 尝试解析错误响应，如果失败则使用默认错误消息
    try {
      const errorData = await response.json();
      throw new Error(errorData.detail || '获取章节列表失败');
    } catch (e) {
      // 如果无法解析JSON，使用响应文本或默认错误消息
      const errorText = await response.text();
      throw new Error(errorText || '获取章节列表失败: 服务器返回错误');
    }
  }

  return await response.json();
};

// 获取单个章节
export const getChapter = async (chapterId) => {
  const response = await fetch(`${API_BASE_URL}/chapters/${chapterId}`, {
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || '获取章节详情失败');
  }

  return await response.json();
};

// 更新章节
export const updateChapter = async (chapterId, chapterData) => {
  const response = await fetch(`${API_BASE_URL}/chapters/${chapterId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(chapterData)
  });

  if (!response.ok) {
    // 尝试解析错误响应，如果失败则使用默认错误消息
    try {
      const errorData = await response.json();
      throw new Error(errorData.detail || '更新章节失败');
    } catch (e) {
      // 如果无法解析JSON，使用响应文本或默认错误消息
      const errorText = await response.text();
      throw new Error(errorText || '更新章节失败: 服务器返回错误');
    }
  }

  return await response.json();
};

// 删除章节
export const deleteChapter = async (chapterId) => {
  const response = await fetch(`${API_BASE_URL}/chapters/${chapterId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || '删除章节失败');
  }

  return await response.json();
};

// 发布章节
export const publishChapter = async (chapterId) => {
  const response = await fetch(`${API_BASE_URL}/chapters/${chapterId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status: 'published' })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || '发布章节失败');
  }

  return await response.json();
};

// 取消发布章节
export const unpublishChapter = async (chapterId) => {
  const response = await fetch(`${API_BASE_URL}/chapters/${chapterId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status: 'draft' })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || '取消发布章节失败');
  }

  return await response.json();
};