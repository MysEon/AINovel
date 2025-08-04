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
      const errorText = await response.clone().text();
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.detail || '创建章节失败');
      } catch (jsonError) {
        // 如果无法解析JSON，使用响应文本或默认错误消息
        throw new Error(errorText || '创建章节失败: 服务器返回错误');
      }
    } catch (e) {
      throw new Error('创建章节失败: 服务器返回错误');
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
      const errorText = await response.clone().text();
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.detail || '获取章节列表失败');
      } catch (jsonError) {
        // 如果无法解析JSON，使用响应文本或默认错误消息
        throw new Error(errorText || '获取章节列表失败: 服务器返回错误');
      }
    } catch (e) {
      throw new Error('获取章节列表失败: 服务器返回错误');
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
      const errorText = await response.clone().text();
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.detail || '更新章节失败');
      } catch (jsonError) {
        // 如果无法解析JSON，使用响应文本或默认错误消息
        throw new Error(errorText || '更新章节失败: 服务器返回错误');
      }
    } catch (e) {
      throw new Error('更新章节失败: 服务器返回错误');
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
    // 尝试解析错误响应，如果失败则使用默认错误消息
    try {
      const errorText = await response.clone().text();
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.detail || '删除章节失败');
      } catch (jsonError) {
        // 如果无法解析JSON，使用响应文本或默认错误消息
        throw new Error(errorText || '删除章节失败: 服务器返回错误');
      }
    } catch (e) {
      throw new Error('删除章节失败: 服务器返回错误');
    }
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
    // 尝试解析错误响应，如果失败则使用默认错误消息
    try {
      const errorText = await response.clone().text();
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.detail || '发布章节失败');
      } catch (jsonError) {
        // 如果无法解析JSON，使用响应文本或默认错误消息
        throw new Error(errorText || '发布章节失败: 服务器返回错误');
      }
    } catch (e) {
      throw new Error('发布章节失败: 服务器返回错误');
    }
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
    // 尝试解析错误响应，如果失败则使用默认错误消息
    try {
      const errorText = await response.clone().text();
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.detail || '取消发布章节失败');
      } catch (jsonError) {
        // 如果无法解析JSON，使用响应文本或默认错误消息
        throw new Error(errorText || '取消发布章节失败: 服务器返回错误');
      }
    } catch (e) {
      throw new Error('取消发布章节失败: 服务器返回错误');
    }
  }

  return await response.json();
};

// 批量更新章节状态
export const batchUpdateChapterStatus = async (updateData) => {
  const response = await fetch(`${API_BASE_URL}/chapters/batch_update_status`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(updateData)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || '批量更新章节状态失败');
  }

  return await response.json();
};

// 批量发布章节
export const batchPublishChapters = async (projectId, chapterIds, onProgress) => {
  const totalChapters = chapterIds.length;
  let successCount = 0;
  let errorCount = 0;
  const results = [];

  for (let i = 0; i < chapterIds.length; i++) {
    const chapterId = chapterIds[i];
    try {
      const response = await fetch(`${API_BASE_URL}/chapters/${chapterId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'published' })
      });

      if (response.ok) {
        const updatedChapter = await response.json();
        results.push({ chapterId, success: true, chapter: updatedChapter });
        successCount++;
      } else {
        const errorData = await response.json();
        results.push({ 
          chapterId, 
          success: false, 
          error: errorData.detail || '发布失败' 
        });
        errorCount++;
      }
    } catch (error) {
      results.push({ 
        chapterId, 
        success: false, 
        error: error.message || '网络错误' 
      });
      errorCount++;
    }

    // 更新进度
    if (onProgress) {
      onProgress({ current: i + 1, total: totalChapters });
    }
  }

  return {
    successCount,
    errorCount,
    totalChapters,
    results
  };
};

// 获取未发布章节列表
export const getUnpublishedChapters = async (projectId, currentChapterId) => {
  const params = new URLSearchParams();
  if (currentChapterId) {
    params.append('current_chapter_id', currentChapterId);
  }
  
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/chapters/unpublished?${params}`, {
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    try {
      const errorText = await response.clone().text();
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.detail || '获取未发布章节列表失败');
      } catch (jsonError) {
        throw new Error(errorText || '获取未发布章节列表失败: 服务器返回错误');
      }
    } catch (e) {
      throw new Error('获取未发布章节列表失败: 服务器返回错误');
    }
  }

  return await response.json();
};

