/**
 * 知识库服务
 * 收口知识库相关 API 调用
 */
import { api } from './core/apiClient.js';

// 获取知识库模块数据
export const getKnowledgeModule = (module, projectId) =>
  api.get(`/knowledge/${module}/${projectId}`);
