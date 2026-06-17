/**
 * 知识库服务
 * 收口知识库相关 API 调用
 *
 * 新后端 API:
 *   GET /knowledge/projects/{project_id}/context?mode=full|outline|chat
 *   GET /knowledge/projects/{project_id}/context/text?mode=full|outline|chat
 *
 * 旧前端调用签名保留兼容（getKnowledgeModule）
 */
import { api } from './core/apiClient.js';

// ── 新 v1 端点 ──

/**
 * 获取项目 AI 上下文（结构化）
 * @param {number} projectId
 * @param {'full'|'outline'|'chat'} mode
 */
export const getProjectContext = (projectId, mode = 'full') =>
  api.get(`/knowledge/projects/${projectId}/context?mode=${mode}`);

/**
 * 获取项目 AI 上下文（纯文本）
 * @param {number} projectId
 * @param {'full'|'outline'|'chat'} mode
 */
export const getProjectContextText = (projectId, mode = 'full') =>
  api.get(`/knowledge/projects/${projectId}/context/text?mode=${mode}`);

const toQueryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const text = query.toString();
  return text ? `?${text}` : '';
};

export const analyzeChapterKnowledge = (projectId, chapterId, modelConfigId, force = false) =>
  api.post(`/knowledge/projects/${projectId}/chapters/${chapterId}/analyze`, {
    model_config_id: modelConfigId,
    force,
  });

/**
 * 查询某章节最近一次知识分析的后台任务状态（供发布后轮询）。
 * 返回 { run_id, status, created_at, started_at, finished_at, error_message }。
 * status: pending | running | succeeded | failed | cancelled | interrupted | null
 */
export const getChapterAnalysisStatus = (projectId, chapterId) =>
  api.get(`/knowledge/projects/${projectId}/chapters/${chapterId}/analysis-status`);

export const getChangeProposals = (projectId, filters = {}) =>
  api.get(`/knowledge/projects/${projectId}/proposals${toQueryString(filters)}`);

export const acceptChangeProposal = (
  proposalId,
  acceptedOperationIds = null,
  rejectedOperationIds = [],
  forceConflicts = false,
) => api.post(`/knowledge/proposals/${proposalId}/accept`, {
  accepted_operation_ids: acceptedOperationIds,
  rejected_operation_ids: rejectedOperationIds,
  force_conflicts: forceConflicts,
});

export const rejectChangeProposal = (proposalId, reason = null) =>
  api.post(`/knowledge/proposals/${proposalId}/reject`, { reason });

export const getEntityRelationships = (projectId, filters = {}) =>
  api.get(`/knowledge/projects/${projectId}/relationships${toQueryString(filters)}`);

export const getEntityStateEvents = (projectId, filters = {}) =>
  api.get(`/knowledge/projects/${projectId}/state-events${toQueryString(filters)}`);

// ── 旧接口兼容 ──

/**
 * 兼容旧组件调用：getKnowledgeModule(module, projectId)
 * 映射到新端点，返回项目上下文数据
 */
export const getKnowledgeModule = async (module, projectId) => {
  try {
    const result = await getProjectContext(projectId, 'full');
    return result.context || result;
  } catch (error) {
    // 新端点不支持按模块查询，返回空数据降级
    console.warn(`知识库模块 "${module}" 查询降级:`, error.message);
    return {};
  }
};
