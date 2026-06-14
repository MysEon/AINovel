// AI服务层 - 连接LangChain/LangGraph API
import { api, rawFetch } from './core/apiClient.js';
import { API_FLAGS } from './core/apiFlags.js';
import { getSelectedModelConfigId, setSelectedModelConfigId } from './core/authStorage.js';
import { EVENT_TYPES } from '../config/agentEventTypes.js';

/**
 * Legacy AI 端点走 /api/ai/* (compat 层)，不走 /api/v1 前缀。
 * 新 AI Runtime 端点走 /api/v1/ai/* (标准 v1 路由)。
 */
const LEGACY_AI_OPTS = { baseURL: '/api' };

// 获取用户的默认模型配置
const getDefaultModelConfig = async () => {
  try {
    const configs = await api.get('/model-configs/');
    return configs.length > 0 ? configs[0] : null;
  } catch {
    return null;
  }
};

// 获取所有可用的模型配置
const getAvailableModelConfigs = async () => {
  try {
    return await api.get('/model-configs/');
  } catch {
    return [];
  }
};

// 检查是否有可用的模型配置
const hasAvailableModelConfigs = async () => {
  try {
    const configs = await getAvailableModelConfigs();
    return configs.length > 0;
  } catch {
    return false;
  }
};

class AIService {
  constructor() {
    this.selectedModelConfigId = null;
    this._loadSelectedModelConfig();
  }

  // 设置当前使用的模型配置ID
  setSelectedModelConfigId(configId) {
    this.selectedModelConfigId = configId;
    setSelectedModelConfigId(configId);
  }

  // 从 localStorage 加载
  _loadSelectedModelConfig() {
    const saved = getSelectedModelConfigId();
    if (saved) {
      const id = parseInt(saved, 10);
      if (!isNaN(id)) this.selectedModelConfigId = id;
    }
  }

  // 清除保存的模型配置
  clearSelectedModelConfig() {
    this.selectedModelConfigId = null;
    setSelectedModelConfigId(null);
  }

  // 获取当前选择的模型配置
  async getSelectedModelConfig() {
    try {
      if (this.selectedModelConfigId) {
        const configs = await getAvailableModelConfigs();
        const found = configs.find(c => c.id === this.selectedModelConfigId);
        if (found) return found;
      }
      return await getDefaultModelConfig();
    } catch {
      return null;
    }
  }

  // 检查模型配置可用性
  async checkModelConfigAvailability() {
    const hasConfigs = await hasAvailableModelConfigs();
    if (!hasConfigs) {
      throw new Error(
        '未找到可用的AI模型配置。请前往"设置"或"模型配置"页面添加您的AI服务配置（如OpenAI、Claude、Gemini等）。'
      );
    }
    return true;
  }

  // 内部辅助：获取 modelConfigId 并构建请求体
  async _withModelConfig(payload) {
    await this.checkModelConfigAvailability();
    const mc = await this.getSelectedModelConfig();
    return { ...payload, model_config_id: mc.id };
  }

  // 章节大纲生成
  async generateChapterOutline(projectId, chapterData) {
    const body = await this._withModelConfig({
      project_id: projectId,
      chapter_number: chapterData.chapter_number || 1,
      user_requirements: chapterData.user_requirements || chapterData.current_content || '',
    });
    return api.post('/ai/chapter-outline', body, LEGACY_AI_OPTS);
  }

  // 章节草稿生成
  async generateChapterDraft(projectId, outline) {
    const body = await this._withModelConfig({
      project_id: projectId,
      chapter_outline: outline,
    });
    return api.post('/ai/chapter-draft', body, LEGACY_AI_OPTS);
  }

  // 角色对话生成
  async generateCharacterDialogue(projectId, characters, context) {
    const body = await this._withModelConfig({
      project_id: projectId,
      character_names: characters,
      situation: context,
    });
    return api.post('/ai/character-dialogue', body, LEGACY_AI_OPTS);
  }

  // 情节发展建议
  async getPlotSuggestions(projectId, currentChapter) {
    const body = await this._withModelConfig({
      project_id: projectId,
      current_chapter_content: currentChapter.content || currentChapter || '',
    });
    return api.post('/ai/plot-suggestions', body, LEGACY_AI_OPTS);
  }

  // AI智能体对话
  async chatWithAI(projectId, message, history = [], promptTemplateId = null) {
    const body = await this._withModelConfig({
      project_id: projectId,
      message,
      history,
    });
    if (promptTemplateId) body.prompt_template_id = promptTemplateId;
    return api.post('/ai/chat', body, LEGACY_AI_OPTS);
  }

  // AI智能体对话 - 流式输出
  async chatWithAIStream(projectId, message, history = [], callbacks = {}, promptTemplateId = null, currentChapterId = null) {
    const body = await this._withModelConfig({
      project_id: projectId,
      message,
      history,
    });
    if (promptTemplateId) body.prompt_template_id = promptTemplateId;
    if (currentChapterId) body.current_chapter_id = currentChapterId;

    const response = await rawFetch('/ai/chat-stream', { method: 'POST', body, ...LEGACY_AI_OPTS });
    if (!response.body) {
      throw new Error('AI 流式响应不可读');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let receivedDone = false;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          buffer += decoder.decode();
          receivedDone = this._flushBuffer(buffer, callbacks) || receivedDone;
          if (!receivedDone) {
            callbacks.onError?.({ message: 'AI 流式连接已关闭' });
            callbacks.onDone?.({});
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (this._dispatchSseLine(line, callbacks) === EVENT_TYPES.DONE) {
            receivedDone = true;
          }
        }
      }
    } catch (error) {
      console.error('流式输出错误:', error);
      throw error;
    }
  }

  // 处理流式输出剩余 buffer
  _flushBuffer(buffer, callbacks = {}) {
    if (!buffer.trim()) return false;

    let receivedDone = false;
    for (const line of buffer.split('\n')) {
      if (this._dispatchSseLine(line, callbacks) === EVENT_TYPES.DONE) {
        receivedDone = true;
      }
    }
    return receivedDone;
  }

  _dispatchSseLine(line, callbacks = {}) {
    if (!line.startsWith('data: ')) return null;

    const data = line.slice(6).trim();
    if (!data) return null;

    let event;
    try {
      event = JSON.parse(data);
    } catch (error) {
      console.warn('无法解析 AI 结构化 SSE 事件:', data, error);
      return null;
    }

    const payload = event?.payload || {};
    switch (event?.type) {
      case EVENT_TYPES.NODE_START:
        callbacks.onNodeStart?.(payload);
        break;
      case EVENT_TYPES.NODE_END:
        callbacks.onNodeEnd?.(payload);
        break;
      case EVENT_TYPES.TOOL_START:
        callbacks.onToolStart?.(payload);
        break;
      case EVENT_TYPES.TOOL_END:
        callbacks.onToolEnd?.(payload);
        break;
      case EVENT_TYPES.TEXT:
        callbacks.onText?.(payload);
        break;
      case EVENT_TYPES.ERROR:
        callbacks.onError?.(payload);
        break;
      case EVENT_TYPES.DONE:
        callbacks.onDone?.(payload);
        break;
      default:
        console.warn('未知 AI 结构化 SSE 事件类型:', event);
        break;
    }

    return event?.type || null;
  }

  // 内容优化
  async optimizeContent(projectId, content, optimizationType = 'general') {
    const body = await this._withModelConfig({
      project_id: projectId, content, optimization_type: optimizationType,
    });
    return api.post('/ai/optimize-content', body, LEGACY_AI_OPTS);
  }

  // 创意生成
  async generateCreativeIdeas(projectId, prompt, category = 'general') {
    const body = await this._withModelConfig({
      project_id: projectId, prompt, category,
    });
    return api.post('/ai/creative-ideas', body, LEGACY_AI_OPTS);
  }

  // 文本风格转换
  transformStyle(projectId, content, targetStyle) {
    return api.post('/ai/transform-style', {
      project_id: projectId, content, target_style: targetStyle,
    }, LEGACY_AI_OPTS);
  }

  // 知识库分析
  analyzeKnowledgeBase(projectId, analysisType = 'comprehensive') {
    return api.post('/ai/analyze-knowledge-base', {
      project_id: projectId, analysis_type: analysisType,
    }, LEGACY_AI_OPTS);
  }

  // 写作建议
  getWritingSuggestions(projectId, content, context = {}) {
    return api.post('/ai/writing-suggestions', {
      project_id: projectId, content, context,
    }, LEGACY_AI_OPTS);
  }

  // 角色关系分析
  analyzeCharacterRelationships(projectId) {
    return api.post('/ai/analyze-character-relationships', { project_id: projectId }, LEGACY_AI_OPTS);
  }

  // 世界观一致性检查
  checkWorldviewConsistency(projectId, content) {
    return api.post('/ai/check-worldview-consistency', { project_id: projectId, content }, LEGACY_AI_OPTS);
  }

  // 情节连贯性分析
  analyzePlotCoherence(projectId) {
    return api.post('/ai/analyze-plot-coherence', { project_id: projectId }, LEGACY_AI_OPTS);
  }

  // 情感分析
  analyzeEmotionalTone(content) {
    return api.post('/ai/analyze-emotional-tone', { content }, LEGACY_AI_OPTS);
  }

  // 阅读难度分析
  analyzeReadability(content) {
    return api.post('/ai/analyze-readability', { content }, LEGACY_AI_OPTS);
  }

  // 批量内容生成
  batchGenerateContent(projectId, requests) {
    return api.post('/ai/batch-generate', { project_id: projectId, requests }, LEGACY_AI_OPTS);
  }

  // AI工作流执行
  executeWorkflow(projectId, workflowId, parameters = {}) {
    return api.post('/ai/execute-workflow', {
      project_id: projectId, workflow_id: workflowId, parameters,
    }, LEGACY_AI_OPTS);
  }

  // 获取AI模型状态
  getModelStatus() {
    return api.get('/ai/model-status', LEGACY_AI_OPTS);
  }

  // 获取可用的工作流列表
  getAvailableWorkflows() {
    return api.get('/ai/workflows', LEGACY_AI_OPTS);
  }

  // 获取AI使用统计
  getUsageStats(projectId) {
    return api.get(`/ai/usage-stats/${projectId}`, LEGACY_AI_OPTS);
  }
}

export const aiService = new AIService();
export { getAvailableModelConfigs, hasAvailableModelConfigs, getDefaultModelConfig };
export default aiService;