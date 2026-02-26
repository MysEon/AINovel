/**
 * 认证服务
 * 收口登录、注册、当前用户查询等认证相关 API
 */
import { api } from './core/apiClient.js';
import { setToken, clearToken } from './core/authStorage.js';

// 登录
export const login = async ({ username, email, password }) => {
  const body = username
    ? { username, password }
    : { email, password };
  const data = await api.post('/auth/login', body, { auth: false });
  if (data.access_token) {
    setToken(data.access_token);
  }
  return data;
};

// 注册
export const register = async ({ username, email, password }) => {
  return api.post('/auth/register', { username, email, password }, { auth: false });
};

// 获取当前用户信息
export const getCurrentUser = () =>
  api.get('/auth/me');

// 登出（仅清理本地状态）
export const logout = () => {
  clearToken();
};
