import { useState, useCallback, useRef } from 'react';
import { EVENT_TYPES } from '../config/agentEventTypes';

/**
 * 消费结构化 SSE 事件流，聚合成可供 UI 消费的状态。
 *
 * 返回:
 *  - events: 已收到的轨迹事件对象数组（按时序，含 node/tool，不含 text）
 *  - textContent: 累计的 LLM 文本（拼好的最终内容）
 *  - status: 'idle' | 'streaming' | 'done' | 'error'
 *  - errorMessage: 最新错误消息（status=error 时有效）
 *  - callbacks: 给 aiService.chatWithAIStream 用的 callbacks 对象
 *  - reset(): 重置状态（开始新一轮调用前用）
 */
export function useAgentEvents() {
  const [events, setEvents] = useState([]);
  const [textContent, setTextContent] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState(null);

  // 用 ref 解决 React 状态合并的竞争（Batch 1 后端高频 token 流）。
  const eventsRef = useRef([]);
  const textRef = useRef('');

  const reset = useCallback(() => {
    eventsRef.current = [];
    textRef.current = '';
    setEvents([]);
    setTextContent('');
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  const appendEvent = useCallback((event) => {
    eventsRef.current = [...eventsRef.current, event];
    setEvents(eventsRef.current);
    setStatus((prev) => (prev === 'streaming' ? prev : 'streaming'));
  }, []);

  const callbacks = {
    onNodeStart: (payload) => {
      appendEvent({ kind: EVENT_TYPES.NODE_START, ...payload, ts: Date.now() });
    },
    onNodeEnd: (payload) => {
      appendEvent({ kind: EVENT_TYPES.NODE_END, ...payload, ts: Date.now() });
    },
    onToolStart: (payload) => {
      appendEvent({ kind: EVENT_TYPES.TOOL_START, ...payload, ts: Date.now() });
    },
    onToolEnd: (payload) => {
      appendEvent({ kind: EVENT_TYPES.TOOL_END, ...payload, ts: Date.now() });
    },
    onText: (payload) => {
      // 高频文本流单独累积，避免把每个 chunk 写入 events。
      textRef.current = textRef.current + (payload?.chunk || '');
      setTextContent(textRef.current);
      setStatus((prev) => (prev === 'streaming' ? prev : 'streaming'));
    },
    onError: (payload) => {
      setErrorMessage(payload?.message || 'AI 流式错误');
      setStatus('error');
    },
    onDone: () => {
      // 不覆盖已经 error 的 status。
      setStatus((prev) => (prev === 'error' ? 'error' : 'done'));
    },
  };

  return { events, textContent, status, errorMessage, callbacks, reset };
}
