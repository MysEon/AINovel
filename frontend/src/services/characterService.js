// 角色管理 API 服务
import { api } from './core/apiClient.js';

// 获取项目下所有角色
export const getCharacters = (projectId) =>
  api.get(`/projects/${projectId}/characters`);

// 获取单个角色
export const getCharacter = (characterId) =>
  api.get(`/characters/${characterId}`);

// 创建角色
export const createCharacter = (projectId, data) =>
  api.post(`/projects/${projectId}/characters`, data);

// 更新角色
export const updateCharacter = (characterId, data) =>
  api.put(`/characters/${characterId}`, data);

// 删除角色
export const deleteCharacter = (characterId) =>
  api.delete(`/characters/${characterId}`);

// 获取角色面板模板（基础模板 + 题材增量）
export const getCharacterTemplates = () =>
  api.get('/character-templates');
