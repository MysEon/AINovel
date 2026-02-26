/**
 * 前端 Feature Flags — 控制 API 版本切换与功能开关
 * 可通过 .env 或运行时配置覆盖
 */

// API 版本开关（按模块）
export const API_FLAGS = {
  // 全局默认版本：'legacy' | 'v1'
  DEFAULT_API_VERSION: 'v1',

  // 是否使用新 AI Runtime（run/session/events 模式）
  USE_AI_RUNTIME_V1: false,

  // 是否使用 SSE 事件流（新 AI Runtime 下）
  USE_AI_SSE_EVENTS_V1: false,
};

/**
 * 获取指定模块的 API 版本
 * 目前所有模块统一使用 DEFAULT_API_VERSION
 */
export function getApiVersionForModule(_module) {
  return API_FLAGS.DEFAULT_API_VERSION;
}
