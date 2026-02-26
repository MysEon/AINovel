// AI服务层 - 连接LangChain/LangGraph API
import { api, rawFetch } from './core/apiClient.js';
import { getSelectedModelConfigId, setSelectedModelConfigId } from './core/authStorage.js';

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
    return api.post('/ai/chapter-outline', body);
  }

  // 章节草稿生成
  async generateChapterDraft(projectId, outline) {
    const body = await this._withModelConfig({
      project_id: projectId,
      chapter_outline: outline,
    });
    return api.post('/ai/chapter-draft', body);
  }

  // 角色对话生成
  async generateCharacterDialogue(projectId, characters, context) {
    const body = await this._withModelConfig({
      project_id: projectId,
      character_names: characters,
      situation: context,
    });
    return api.post('/ai/character-dialogue', body);
  }

  // 情节发展建议
  async getPlotSuggestions(projectId, currentChapter) {
    const body = await this._withModelConfig({
      project_id: projectId,
      current_chapter_content: currentChapter.content || currentChapter || '',
    });
    return api.post('/ai/plot-suggestions', body);
  }

  // AI智能体对话
  async chatWithAI(projectId, message, history = [], promptTemplateId = null) {
    const body = await this._withModelConfig({
      project_id: projectId,
      message,
      history,
    });
    if (promptTemplateId) body.prompt_template_id = promptTemplateId;
    return api.post('/ai/chat', body);
  }

  // AI智能体对话 - 流式输出
  async chatWithAIStream(projectId, message, history = [], onChunk, onComplete, promptTemplateId = null) {
    const body = await this._withModelConfig({
      project_id: projectId,
      message,
      history,
    });
    if (promptTemplateId) body.prompt_template_id = promptTemplateId;

    const response = await rawFetch('/ai/chat-stream', { method: 'POST', body });
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          this._flushBuffer(buffer, onChunk, onComplete);
          if (onComplete) onComplete();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') { if (onComplete) onComplete(); return; }
          if (data && !data.startsWith('错误:') && onChunk) onChunk(data);
        }
      }
    } catch (error) {
      console.error('流式输出错误:', error);
      throw error;
    }
  }

  // 处理流式输出剩余 buffer
  _flushBuffer(buffer, onChunk) {
    if (!buffer.trim()) return;
    for (const line of buffer.split('\n')) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data && data !== '[DONE]' && !data.startsWith('错误:') && onChunk) {
          onChunk(data);
        }
      }
    }
  }

  // 内容优化
  async optimizeContent(projectId, content, optimizationType = 'general') {
    const body = await this._withModelConfig({
      project_id: projectId, content, optimization_type: optimizationType,
    });
    return api.post('/ai/optimize-content', body);
  }

  // 创意生成
  async generateCreativeIdeas(projectId, prompt, category = 'general') {
    const body = await this._withModelConfig({
      project_id: projectId, prompt, category,
    });
    return api.post('/ai/creative-ideas', body);
  }

  // 文本风格转换
  transformStyle(projectId, content, targetStyle) {
    return api.post('/ai/transform-style', {
      project_id: projectId, content, target_style: targetStyle,
    });
  }

  // 知识库分析
  analyzeKnowledgeBase(projectId, analysisType = 'comprehensive') {
    return api.post('/ai/analyze-knowledge-base', {
      project_id: projectId, analysis_type: analysisType,
    });
  }

  // 写作建议
  getWritingSuggestions(projectId, content, context = {}) {
    return api.post('/ai/writing-suggestions', {
      project_id: projectId, content, context,
    });
  }

  // 角色关系分析
  analyzeCharacterRelationships(projectId) {
    return api.post('/ai/analyze-character-relationships', { project_id: projectId });
  }

  // 世界观一致性检查
  checkWorldviewConsistency(projectId, content) {
    return api.post('/ai/check-worldview-consistency', { project_id: projectId, content });
  }

  // 情节连贯性分析
  analyzePlotCoherence(projectId) {
    return api.post('/ai/analyze-plot-coherence', { project_id: projectId });
  }

  // 情感分析
  analyzeEmotionalTone(content) {
    return api.post('/ai/analyze-emotional-tone', { content });
  }

  // 阅读难度分析
  analyzeReadability(content) {
    return api.post('/ai/analyze-readability', { content });
  }

  // 批量内容生成
  batchGenerateContent(projectId, requests) {
    return api.post('/ai/batch-generate', { project_id: projectId, requests });
  }

  // AI工作流执行
  executeWorkflow(projectId, workflowId, parameters = {}) {
    return api.post('/ai/execute-workflow', {
      project_id: projectId, workflow_id: workflowId, parameters,
    });
  }

  // 获取AI模型状态
  getModelStatus() {
    return api.get('/ai/model-status');
  }

  // 获取可用的工作流列表
  getAvailableWorkflows() {
    return api.get('/ai/workflows');
  }

  // 获取AI使用统计
  getUsageStats(projectId) {
    return api.get(`/ai/usage-stats/${projectId}`);
  }
}

export const aiService = new AIService();
export { getAvailableModelConfigs, hasAvailableModelConfigs, getDefaultModelConfig };
export default aiService;