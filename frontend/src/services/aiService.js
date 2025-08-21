// AI服务层 - 连接LangChain/LangGraph API
const API_BASE_URL = '/api';

// 获取认证头
const getAuthHeaders = () => {
  const token = localStorage.getItem('ainovel_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

class AIService {
  constructor() {
    this.baseURL = `${API_BASE_URL}/ai`;
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || 'AI服务请求失败');
    }

    return response.json();
  }

  // 章节大纲生成
  async generateChapterOutline(projectId, chapterData) {
    return this.request('/chapter-outline', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        title: chapterData.title,
        current_content: chapterData.current_content || '',
        chapter_number: chapterData.chapter_number || 1
      })
    });
  }

  // 章节草稿生成
  async generateChapterDraft(projectId, outline) {
    return this.request('/chapter-draft', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        outline: outline
      })
    });
  }

  // 角色对话生成
  async generateCharacterDialogue(projectId, characters, context) {
    return this.request('/character-dialogue', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        characters: characters,
        context: context
      })
    });
  }

  // 情节发展建议
  async getPlotSuggestions(projectId, currentChapter) {
    return this.request('/plot-suggestions', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        current_chapter: currentChapter
      })
    });
  }

  // AI智能体对话
  async chatWithAI(projectId, message, history = []) {
    return this.request('/chat', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        message: message,
        history: history
      })
    });
  }

  // 内容优化
  async optimizeContent(projectId, content, optimizationType = 'general') {
    return this.request('/optimize-content', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        content: content,
        optimization_type: optimizationType
      })
    });
  }

  // 创意生成
  async generateCreativeIdeas(projectId, prompt, category = 'general') {
    return this.request('/creative-ideas', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        prompt: prompt,
        category: category
      })
    });
  }

  // 文本风格转换
  async transformStyle(projectId, content, targetStyle) {
    return this.request('/transform-style', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        content: content,
        target_style: targetStyle
      })
    });
  }

  // 知识库分析
  async analyzeKnowledgeBase(projectId, analysisType = 'comprehensive') {
    return this.request('/analyze-knowledge-base', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        analysis_type: analysisType
      })
    });
  }

  // 写作建议
  async getWritingSuggestions(projectId, content, context = {}) {
    return this.request('/writing-suggestions', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        content: content,
        context: context
      })
    });
  }

  // 角色关系分析
  async analyzeCharacterRelationships(projectId) {
    return this.request('/analyze-character-relationships', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId
      })
    });
  }

  // 世界观一致性检查
  async checkWorldviewConsistency(projectId, content) {
    return this.request('/check-worldview-consistency', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        content: content
      })
    });
  }

  // 情节连贯性分析
  async analyzePlotCoherence(projectId) {
    return this.request('/analyze-plot-coherence', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId
      })
    });
  }

  // 情感分析
  async analyzeEmotionalTone(content) {
    return this.request('/analyze-emotional-tone', {
      method: 'POST',
      body: JSON.stringify({
        content: content
      })
    });
  }

  // 阅读难度分析
  async analyzeReadability(content) {
    return this.request('/analyze-readability', {
      method: 'POST',
      body: JSON.stringify({
        content: content
      })
    });
  }

  // 批量内容生成
  async batchGenerateContent(projectId, requests) {
    return this.request('/batch-generate', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        requests: requests
      })
    });
  }

  // AI工作流执行
  async executeWorkflow(projectId, workflowId, parameters = {}) {
    return this.request('/execute-workflow', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        workflow_id: workflowId,
        parameters: parameters
      })
    });
  }

  // 获取AI模型状态
  async getModelStatus() {
    return this.request('/model-status');
  }

  // 获取可用的工作流列表
  async getAvailableWorkflows() {
    return this.request('/workflows');
  }

  // 获取AI使用统计
  async getUsageStats(projectId) {
    return this.request(`/usage-stats/${projectId}`);
  }
}

export const aiService = new AIService();
export default aiService;