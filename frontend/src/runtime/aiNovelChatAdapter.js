import { aiService } from '../services/aiService';

const getTextFromParts = (content = []) => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .filter((part) => part?.type === 'text')
    .map((part) => part.text || '')
    .join('');
};

const toLegacyHistoryMessage = (message) => ({
  role: message.role,
  content: getTextFromParts(message.content),
});

const createThinkingTracePart = ({ traceEvents, traceStatus, errorMessage }) => ({
  type: 'tool-call',
  toolCallId: 'thinking-trace',
  toolName: 'thinking_trace',
  args: {
    events: [...traceEvents],
    status: traceStatus,
    errorMessage,
  },
  argsText: JSON.stringify({
    events: traceEvents,
    status: traceStatus,
    errorMessage,
  }),
});

const createTextPart = (text) => ({ type: 'text', text });

export const createAINovelChatAdapter = ({ projectId, selectedPromptTemplate, service = null }) => ({
  async *run({ messages, abortSignal }) {
    const userMessage = [...messages].reverse().find((message) => message.role === 'user');
    const userText = getTextFromParts(userMessage?.content).trim();

    if (!projectId) {
      yield {
        content: [createTextPart('项目 ID 缺失，无法连接 AI 写作助手。')],
        status: { type: 'incomplete', reason: 'error', error: 'missing_project_id' },
      };
      return;
    }

    if (!userText) {
      yield { content: [createTextPart('请输入想和 AI 助手讨论的内容。')] };
      return;
    }

    const history = messages
      .filter((message) => message !== userMessage && (message.role === 'user' || message.role === 'assistant'))
      .map(toLegacyHistoryMessage)
      .filter((message) => message.content);

    let accumulatedText = '';
    const traceEvents = [];
    let traceStatus = 'streaming';
    let errorMessage = null;

    const chunks = [];
    let resolveNext = null;
    let done = false;
    let error = null;
    let aborted = false;

    const wakeup = () => {
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        resolve();
      }
    };

    const markChanged = (kind) => {
      chunks.push(kind);
      wakeup();
    };

    const callbacks = {
      onText: (payload) => {
        if (aborted) return;
        accumulatedText += payload?.chunk || '';
        markChanged('text');
      },
      onNodeStart: (payload) => {
        if (aborted) return;
        traceEvents.push({ kind: 'node_start', ...payload, ts: Date.now() });
        markChanged('trace');
      },
      onNodeEnd: (payload) => {
        if (aborted) return;
        traceEvents.push({ kind: 'node_end', ...payload, ts: Date.now() });
        markChanged('trace');
      },
      onToolStart: (payload) => {
        if (aborted) return;
        traceEvents.push({ kind: 'tool_start', ...payload, ts: Date.now() });
        markChanged('trace');
      },
      onToolEnd: (payload) => {
        if (aborted) return;
        traceEvents.push({ kind: 'tool_end', ...payload, ts: Date.now() });
        markChanged('trace');
      },
      onError: (payload) => {
        if (aborted) return;
        errorMessage = payload?.message || 'AI 流式错误';
        traceStatus = 'error';
        markChanged('error');
      },
      onDone: () => {
        if (traceStatus !== 'error') traceStatus = 'done';
        done = true;
        wakeup();
      },
    };

    const streamPromise = aiService.chatWithAIStream(
      projectId,
      userText,
      history,
      callbacks,
      selectedPromptTemplate?.id || null
    ).catch((err) => {
      error = err;
      errorMessage = err?.message || 'AI 流式错误';
      traceStatus = 'error';
      done = true;
      wakeup();
    });

    const handleAbort = () => {
      aborted = true;
      done = true;
      traceStatus = traceStatus === 'error' ? 'error' : 'done';
      wakeup();
    };

    abortSignal?.addEventListener('abort', handleAbort, { once: true });

    try {
      while (!done || chunks.length > 0) {
        if (chunks.length === 0 && !done) {
          await new Promise((resolve) => {
            resolveNext = resolve;
          });
        }

        chunks.length = 0;

        const content = [];
        if (traceEvents.length > 0) {
          content.push(createThinkingTracePart({ traceEvents, traceStatus, errorMessage }));
        }
        if (accumulatedText) {
          content.push(createTextPart(accumulatedText));
        }
        if (!accumulatedText && errorMessage && traceEvents.length === 0) {
          content.push(createTextPart(`抱歉，AI服务暂时不可用: ${errorMessage}`));
        }

        if (content.length > 0) {
          yield {
            content,
            status: traceStatus === 'error'
              ? { type: 'incomplete', reason: 'error', error: errorMessage }
              : undefined,
          };
        }
      }
    } finally {
      abortSignal?.removeEventListener('abort', handleAbort);
    }

    await streamPromise;
    if (error && !aborted) throw error;
  },
});

export const __testing__ = {
  getTextFromParts,
  createThinkingTracePart,
};
