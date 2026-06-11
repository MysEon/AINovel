/**
 * 统一认证存储工具
 * 收口所有 token 读写、清理逻辑，避免各 service 重复实现
 * M2 更新：支持 access_token + refresh_token 双令牌存储
 */

const TOKEN_KEY = 'ainovel_token';
const REFRESH_TOKEN_KEY = 'ainovel_refresh_token';
const TOKEN_BACKUP_KEY = 'ainovel_token_backup';
const SELECTED_MODEL_CONFIG_KEY = 'ainovel_selected_model_config';

/**
 * 清洗 token（去除可能存在的引号包装）
 */
function cleanToken(raw) {
  if (!raw || typeof raw !== 'string') return null;
  return raw.replace(/^"|"$/g, '');
}

/**
 * 获取当前 access token（已清洗）
 */
export function getToken() {
  const raw = localStorage.getItem(TOKEN_KEY);
  return cleanToken(raw);
}

/**
 * 获取当前 refresh token
 */
export function getRefreshToken() {
  const raw = localStorage.getItem(REFRESH_TOKEN_KEY);
  return cleanToken(raw);
}

/**
 * 同时保存 access + refresh token
 */
export function setTokens(accessToken, refreshToken) {
  if (accessToken) {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(TOKEN_BACKUP_KEY, accessToken);
  }
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

/**
 * 保存单个 access token（兼容旧接口）
 */
export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_BACKUP_KEY, token);
  }
}

/**
 * 清除所有 token 及相关认证状态
 */
export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_BACKUP_KEY);
}

/**
 * 清除 token（兼容旧接口）
 */
export function clearToken() {
  clearTokens();
}

/**
 * 判断是否已登录（有 access token）
 */
export function isAuthenticated() {
  return !!getToken();
}

// ── 模型配置选择持久化 ──

export function getSelectedModelConfigId() {
  return localStorage.getItem(SELECTED_MODEL_CONFIG_KEY);
}

export function setSelectedModelConfigId(id) {
  if (id) {
    localStorage.setItem(SELECTED_MODEL_CONFIG_KEY, id);
  } else {
    localStorage.removeItem(SELECTED_MODEL_CONFIG_KEY);
  }
}

// ── 常量导出（供外部引用 key 名） ──
export const STORAGE_KEYS = {
  TOKEN: TOKEN_KEY,
  REFRESH_TOKEN: REFRESH_TOKEN_KEY,
  TOKEN_BACKUP: TOKEN_BACKUP_KEY,
  SELECTED_MODEL_CONFIG: SELECTED_MODEL_CONFIG_KEY,
  // App 状态
  LAST_VIEW: 'ainovel_last_view',
  CURRENT_PROJECT: 'ainovel_current_project',
  // 其他
  PARTICLE_SHAPES: 'ainovel_particle_shapes',
  ERROR_LOG: 'ainovel_errors',
};
