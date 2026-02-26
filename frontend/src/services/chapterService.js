// 章节相关的API服务
import { api } from './core/apiClient.js';

// 创建章节
export const createChapter = (projectId, chapterData) =>
  api.post(`/projects/${projectId}/chapters`, chapterData);

// 获取项目的所有章节
export const getChapters = (projectId) =>
  api.get(`/projects/${projectId}/chapters`);

// 获取单个章节
export const getChapter = (chapterId) =>
  api.get(`/chapters/${chapterId}`);

// 更新章节
export const updateChapter = (chapterId, chapterData) =>
  api.put(`/chapters/${chapterId}`, chapterData);

// 删除章节
export const deleteChapter = (chapterId) =>
  api.delete(`/chapters/${chapterId}`);

// 发布章节
export const publishChapter = (chapterId) =>
  api.put(`/chapters/${chapterId}`, { status: 'published' });

// 取消发布章节
export const unpublishChapter = (chapterId) =>
  api.put(`/chapters/${chapterId}`, { status: 'draft' });

// 批量更新章节状态
export const batchUpdateChapterStatus = (updateData) =>
  api.post('/chapters/batch_update_status', updateData);

// 批量发布章节（逐章发布，带进度回调）
export const batchPublishChapters = async (projectId, chapterIds, onProgress) => {
  const totalChapters = chapterIds.length;
  let successCount = 0;
  let errorCount = 0;
  const results = [];

  for (let i = 0; i < chapterIds.length; i++) {
    const chapterId = chapterIds[i];
    try {
      const chapter = await api.put(`/chapters/${chapterId}`, { status: 'published' });
      results.push({ chapterId, success: true, chapter });
      successCount++;
    } catch (error) {
      results.push({ chapterId, success: false, error: error.message || '发布失败' });
      errorCount++;
    }
    if (onProgress) onProgress({ current: i + 1, total: totalChapters });
  }

  return { successCount, errorCount, totalChapters, results };
};

// 获取未发布章节列表
export const getUnpublishedChapters = (projectId, currentChapterId) => {
  const params = currentChapterId ? `?current_chapter_id=${currentChapterId}` : '';
  return api.get(`/projects/${projectId}/chapters/unpublished${params}`);
};
