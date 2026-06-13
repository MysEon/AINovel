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

/**
 * 流式调用 AI 写作助手 chat 接口。
 *
 * 用于 useExternalStoreRuntime 的 onNew 流程：
 * - history 是已经在 messages 数组里、且不含本次 userText 的历史
 * - onUpdate 每次有新内容（text/trace/error）就被调用一次，参数是「累积后的完整 content array」
 * - onUpdate 不应改变 onUpdate 之间的引用：调用方应该用它来 setMessages 更新对应 assistantId
 * - 返回 Promise<void>，resolve 表示流式结束（包括 abort）；reject 仅在非 abort 错误时
 */
export const runChatStream = async ({
  projectId,
  userText,
  history,
  selectedPromptTemplate,
  abortSignal,
  onUpdate,
}) => {
  if (!projectId) {
    onUpdate?.({
      content: [createTextPart('项目 ID 缺失，无法连接 AI 写作助手。')],
      status: { type: 'incomplete', reason: 'error', error: 'missing_project_id' },
    });
    return;
  }

  if (!userText) {
    onUpdate?.({ content: [createTextPart('请输入想和 AI 助手讨论的内容。')] });
    return;
  }

  let accumulatedText = '';
  const traceEvents = [];
  let traceStatus = 'streaming';
  let errorMessage = null;
  let aborted = false;

  const emit = () => {
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
    if (content.length === 0) return;
    onUpdate?.({
      content,
      status: traceStatus === 'error'
        ? { type: 'incomplete', reason: 'error', error: errorMessage }
        : undefined,
    });
  };

  const callbacks = {
    onText: (payload) => {
      if (aborted) return;
      accumulatedText += payload?.chunk || '';
      emit();
    },
    onNodeStart: (payload) => {
      if (aborted) return;
      traceEvents.push({ kind: 'node_start', ...payload, ts: Date.now() });
      emit();
    },
    onNodeEnd: (payload) => {
      if (aborted) return;
      traceEvents.push({ kind: 'node_end', ...payload, ts: Date.now() });
      emit();
    },
    onToolStart: (payload) => {
      if (aborted) return;
      traceEvents.push({ kind: 'tool_start', ...payload, ts: Date.now() });
      emit();
    },
    onToolEnd: (payload) => {
      if (aborted) return;
      traceEvents.push({ kind: 'tool_end', ...payload, ts: Date.now() });
      emit();
    },
    onError: (payload) => {
      if (aborted) return;
      errorMessage = payload?.message || 'AI 流式错误';
      traceStatus = 'error';
      emit();
    },
    onDone: () => {
      if (aborted) return;
      if (traceStatus !== 'error') traceStatus = 'done';
      emit();
    },
  };

  const handleAbort = () => {
    aborted = true;
    if (traceStatus !== 'error') traceStatus = 'done';
    emit();
  };
  abortSignal?.addEventListener('abort', handleAbort, { once: true });

  try {
    await aiService.chatWithAIStream(
      projectId,
      userText,
      history,
      callbacks,
      selectedPromptTemplate?.id || null
    );
  } catch (err) {
    if (aborted) return;
    errorMessage = err?.message || 'AI 流式错误';
    traceStatus = 'error';
    emit();
    throw err;
  } finally {
    abortSignal?.removeEventListener('abort', handleAbort);
  }
};

/**
 * [Deprecated] useLocalRuntime adapter 形态。AIChatPanel 已切换到
 * useExternalStoreRuntime + runChatStream，这个 factory 暂时保留是为了未来
 * 单测复用或其他 LocalRuntime 场景。
 */
export const createAINovelChatAdapter = ({ projectId, selectedPromptTemplate }) => ({
  async *run({ messages, abortSignal }) {
    const userMessage = [...messages].reverse().find((message) => message.role === 'user');
    const userText = getTextFromParts(userMessage?.content).trim();

    const history = messages
      .filter((message) => message !== userMessage && (message.role === 'user' || message.role === 'assistant'))
      .map(toLegacyHistoryMessage)
      .filter((message) => message.content);

    const chunks = [];
    let resolveNext = null;
    let done = false;

    const wakeup = () => {
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        resolve();
      }
    };

    const streamPromise = runChatStream({
      projectId,
      userText,
      history,
      selectedPromptTemplate,
      abortSignal,
      onUpdate: (payload) => {
        chunks.push(payload);
        wakeup();
      },
    }).finally(() => {
      done = true;
      wakeup();
    });

    try {
      while (!done || chunks.length > 0) {
        if (chunks.length === 0 && !done) {
          await new Promise((resolve) => {
            resolveNext = resolve;
          });
        }
        while (chunks.length > 0) {
          yield chunks.shift();
        }
      }
    } finally {
      await streamPromise.catch(() => {});
    }
  },
});

export const __testing__ = {
  getTextFromParts,
  createThinkingTracePart,
  toLegacyHistoryMessage,
};
