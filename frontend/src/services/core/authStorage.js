/**
 * 统一认证存储工具
 * 收口所有 token 读写、清理逻辑，避免各 service 重复实现
 */

const TOKEN_KEY = 'ainovel_token';
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
 * 获取当前 token（已清洗）
 */
export function getToken() {
  const raw = localStorage.getItem(TOKEN_KEY);
  return cleanToken(raw);
}

/**
 * 保存 token
 */
export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_BACKUP_KEY, token);
  }
}

/**
 * 清除 token 及相关认证状态
 */
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_BACKUP_KEY);
}

/**
 * 判断是否已登录（有 token）
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
  TOKEN_BACKUP: TOKEN_BACKUP_KEY,
  SELECTED_MODEL_CONFIG: SELECTED_MODEL_CONFIG_KEY,
};
