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

// 批量发布章节（使用后端批量接口）
export const batchPublishChapters = async (projectId, chapterIds, onProgress) => {
  if (onProgress) onProgress({ current: 0, total: chapterIds.length });
  const result = await api.post('/chapters/batch-publish', {
    project_id: projectId,
    chapter_ids: chapterIds,
  });
  if (onProgress) onProgress({ current: chapterIds.length, total: chapterIds.length });
  // 适配返回格式：后端返回 BatchPublishResponse
  return {
    successCount: result.success_count ?? 0,
    errorCount: (result.total_count ?? 0) - (result.success_count ?? 0),
    totalChapters: result.total_count ?? chapterIds.length,
    results: [
      ...(result.published_chapters || []).map(c => ({ chapterId: c.id, success: true, chapter: c })),
      ...(result.failed_chapters || []).map(c => ({ chapterId: c.id, success: false, error: c.reason })),
    ],
  };
};

// 获取未发布章节列表
export const getUnpublishedChapters = (projectId, currentChapterId) => {
  const params = currentChapterId ? `?current_chapter_id=${currentChapterId}` : '';
  return api.get(`/projects/${projectId}/chapters/unpublished${params}`);
};
