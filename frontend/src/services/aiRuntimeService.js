/**
 * AI Runtime Service — 新 v1 工作流运行 API
 *
 * 封装 Run / Session / Event / Artifact 端点。
 * 所有请求走 /api/v1/ai/* (标准 v1 路由)。
 *
 * 由 apiFlags.USE_AI_RUNTIME_V1 控制是否启用。
 */
import { api, rawFetch } from './core/apiClient.js';

// ── 工作流类型 ──

export const getWorkflowTypes = () => api.get('/ai/workflow-types');

// ── Run CRUD ──

/**
 * 查询单次运行状态
 * @returns {Promise<RunResponse>}
 */
export const getRun = (runId) => api.get(`/ai/runs/${runId}`);

/**
 * 列出运行记录（支持筛选）
 * @param {object} filters - { project_id, workflow_type, status, skip, limit }
 * @returns {Promise<RunListResponse>}
 */
export function listRuns(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(filters)) {
    if (val !== undefined && val !== null) params.append(key, val);
  }
  const qs = params.toString();
  return api.get(`/ai/runs${qs ? `?${qs}` : ''}`);
}

/**
 * 取消运行（仅 pending/running 可取消）
 * @returns {Promise<RunResponse>}
 */
export const cancelRun = (runId) => api.post(`/ai/runs/${runId}/cancel`);

// ── Run Events ──

/**
 * 获取运行的事件列表
 * @returns {Promise<EventResponse[]>}
 */
export const getRunEvents = (runId) => api.get(`/ai/runs/${runId}/events`);

// ── Session ──

/**
 * 查看会话详情
 * @returns {Promise<SessionResponse>}
 */
export const getSession = (sessionId) => api.get(`/ai/sessions/${sessionId}`);

// ── Artifact ──

/**
 * 获取 AI 生成产物
 * @returns {Promise<ArtifactResponse>}
 */
export const getArtifact = (artifactId) => api.get(`/ai/artifacts/${artifactId}`);

// ── SSE 事件流 ──

/**
 * 订阅运行的 SSE 事件流
 *
 * 后端行为：
 *  - run 已完成 → 回放历史事件后发送 { type: 'done' }
 *  - run 进行中 → 发送 { type: 'info', status } 提示
 *
 * @param {number} runId
 * @param {object} callbacks
 * @param {function} callbacks.onEvent  - 收到事件 { type, node, sequence, data }
 * @param {function} callbacks.onDone   - 流结束 { type: 'done', status }
 * @param {function} callbacks.onError  - 错误回调
 * @returns {function} abort — 调用可取消流
 */
export function subscribeRunStream(runId, { onEvent, onDone, onError } = {}) {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await rawFetch(`/ai/runs/${runId}/stream`, {
        method: 'GET',
        signal: controller.signal,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const payload = JSON.parse(raw);
            if (payload.type === 'done') {
              if (onDone) onDone(payload);
            } else {
              if (onEvent) onEvent(payload);
            }
          } catch {
            // 非 JSON 行，忽略
          }
        }
      }

      // 流正常结束但未收到 done 事件
      if (onDone) onDone({ type: 'done', status: 'stream_ended' });
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (onError) onError(err);
    }
  })();

  return () => controller.abort();
}
