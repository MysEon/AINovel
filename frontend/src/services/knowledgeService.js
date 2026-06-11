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
