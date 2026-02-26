/**
 * 统一 API 客户端
 * 收口所有 HTTP 请求：baseURL、auth header、错误解析、401 处理
 */

import { getToken, clearToken } from './authStorage.js';
import { API_FLAGS } from './apiFlags.js';

// ── 配置 ──

const API_VERSION_MAP = {
  legacy: '/api',
  v1: '/api/v1',
};

// 从 feature flags 读取默认版本
let _apiVersion = API_FLAGS.DEFAULT_API_VERSION;

/**
 * 设置全局 API 版本
 * @param {'legacy'|'v1'} version
 */
export function setApiVersion(version) {
  if (API_VERSION_MAP[version]) {
    _apiVersion = version;
  }
}

export function getBaseURL() {
  return API_VERSION_MAP[_apiVersion] || '/api';
}

// ── 401 回调 ──

let _onUnauthorized = null;

/**
 * 注册 401 处理回调（由 App 层设置，如跳转登录页）
 */
export function onUnauthorized(callback) {
  _onUnauthorized = callback;
}

// ── 调试日志 ──

const API_DEBUG = import.meta.env.DEV;

function debugLog(method, url, status) {
  if (!API_DEBUG) return;
  console.log(`[apiClient] ${method} ${url} → ${status}`);
}

// ── 错误标准化 ──

/**
 * 将后端各种错误格式统一为前端标准对象
 * 兼容旧格式 { detail } 和新格式 { code, message, detail, trace_id }
 */
export async function normalizeApiError(response) {
  const status = response.status;
  let body = null;

  try {
    body = await response.json();
  } catch {
    // 非 JSON 响应
  }

  let message = `HTTP ${status}: ${response.statusText}`;
  let detail = null;
  let traceId = null;

  if (body) {
    if (typeof body.detail === 'string') {
      message = body.detail;
    } else if (Array.isArray(body.detail)) {
      message = body.detail.map(d => d.msg || d).join('; ');
    } else if (body.message) {
      message = body.message;
    }
    detail = body.detail ?? null;
    traceId = body.trace_id ?? null;
  }

  return { status, message, detail, traceId, retryable: status >= 500 };
}

// ── 核心请求函数 ──

/**
 * 统一请求入口
 * @param {string} path - 相对路径，如 '/projects/'
 * @param {object} options
 * @param {string} [options.method='GET']
 * @param {object} [options.body] - 请求体（自动 JSON 序列化）
 * @param {object} [options.headers] - 额外 headers
 * @param {boolean} [options.auth=true] - 是否注入 Authorization
 * @param {string} [options.baseURL] - 覆盖默认 baseURL
 * @returns {Promise<any>} 响应 JSON
 */
export async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    headers: extraHeaders = {},
    auth = true,
    baseURL,
  } = options;

  const base = baseURL || getBaseURL();
  const url = `${base}${path}`;

  // 构建 headers
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  if (auth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const fetchOptions = { method, headers };
  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  debugLog(method, url, response.status);

  // 401 统一处理
  if (response.status === 401) {
    clearToken();
    if (_onUnauthorized) _onUnauthorized();
    throw Object.assign(new Error('Not authenticated'), { status: 401 });
  }

  if (!response.ok) {
    const err = await normalizeApiError(response);
    throw Object.assign(new Error(err.message), err);
  }

  // 204 No Content
  if (response.status === 204) return null;

  return response.json();
}

// ── 便捷方法 ──

export const api = {
  get:    (path, opts) => request(path, { ...opts, method: 'GET' }),
  post:   (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put:    (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch:  (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
};

// ── 流式请求（返回原始 Response，供 SSE/streaming 使用） ──

/**
 * 发起请求但不解析 body，返回原始 Response
 * 用于流式场景（aiService 的 chatWithAIStream 等）
 */
export async function rawFetch(path, options = {}) {
  const {
    method = 'POST',
    body,
    headers: extraHeaders = {},
    auth = true,
    baseURL,
  } = options;

  const base = baseURL || getBaseURL();
  const url = `${base}${path}`;

  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  if (auth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const fetchOptions = { method, headers };
  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  debugLog(method, url, response.status);

  if (response.status === 401) {
    clearToken();
    if (_onUnauthorized) _onUnauthorized();
    throw Object.assign(new Error('Not authenticated'), { status: 401 });
  }

  if (!response.ok) {
    const err = await normalizeApiError(response);
    throw Object.assign(new Error(err.message), err);
  }

  return response;
}
