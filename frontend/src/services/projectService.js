// 项目相关的API服务
import { api } from './core/apiClient.js';

// 创建项目
export const createProject = (projectData) =>
  api.post('/projects/', projectData);

// 获取用户的所有项目
export const getUserProjects = () =>
  api.get('/projects/');

// 获取单个项目
export const getProject = (projectId) =>
  api.get(`/projects/${projectId}`);

// 更新项目
export const updateProject = (projectId, projectData) =>
  api.put(`/projects/${projectId}`, projectData);

// 删除项目
export const deleteProject = (projectId) =>
  api.delete(`/projects/${projectId}`);
