// AI服务层 - 连接LangChain/LangGraph API
const API_BASE_URL = '/api';

// 获取认证头
const getAuthHeaders = () => {
  let token = localStorage.getItem('ainovel_token');
  
  // 清理token中可能存在的引号包装
  if (token && typeof token === 'string') {
    token = token.replace(/^"|"$/g, '');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

// 获取用户的默认模型配置
const getDefaultModelConfig = async () => {
  try {
    console.log('正在获取默认模型配置...');
    const response = await fetch(`${API_BASE_URL}/model-configs`, {
      headers: getAuthHeaders()
    });
    
    console.log('默认模型配置API响应状态:', response.status);
    
    if (!response.ok) {
      if (response.status === 401) {
        console.warn('用户未登录或token已过期，无法获取模型配置');
        return null;
      }
      throw new Error('获取模型配置失败');
    }
    
    const configs = await response.json();
    console.log('获取到的默认模型配置:', configs);
    // 返回第一个可用的配置，或者null
    return configs.length > 0 ? configs[0] : null;
  } catch (error) {
    console.error('获取默认模型配置失败:', error);
    return null;
  }
};

// 获取所有可用的模型配置
const getAvailableModelConfigs = async () => {
  try {
    console.log('正在获取模型配置...');
    const response = await fetch(`${API_BASE_URL}/model-configs`, {
      headers: getAuthHeaders()
    });
    
    console.log('模型配置API响应状态:', response.status);
    
    if (!response.ok) {
      if (response.status === 401) {
        console.warn('用户未登录或token已过期，无法获取模型配置');
        return [];
      }
      const errorText = await response.text();
      console.error('模型配置API错误响应:', errorText);
      throw new Error(`获取模型配置失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('获取到的模型配置:', data);
    return data;
  } catch (error) {
    console.error('获取可用模型配置失败:', error);
    return [];
  }
};

// 检查是否有可用的模型配置
const hasAvailableModelConfigs = async () => {
  try {
    const configs = await getAvailableModelConfigs();
    return configs.length > 0;
  } catch (error) {
    console.error('检查模型配置可用性失败:', error);
    return false;
  }
};

class AIService {
  constructor() {
    this.baseURL = `${API_BASE_URL}/ai`;
    this.selectedModelConfigId = null; // 存储用户选择的模型配置ID
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

  // 设置当前使用的模型配置ID
  setSelectedModelConfigId(configId) {
    this.selectedModelConfigId = configId;
  }

  // 获取当前选择的模型配置
  async getSelectedModelConfig() {
    try {
      // 如果有选择的配置ID，优先使用
      if (this.selectedModelConfigId) {
        const configs = await getAvailableModelConfigs();
        const selectedConfig = configs.find(config => config.id === this.selectedModelConfigId);
        if (selectedConfig) {
          return selectedConfig;
        }
      }
      
      // 否则使用默认配置
      return await getDefaultModelConfig();
    } catch (error) {
      console.error('获取选择的模型配置失败:', error);
      return null;
    }
  }

  // 检查是否有可用的模型配置，如果没有则提供详细的错误信息
  async checkModelConfigAvailability() {
    const hasConfigs = await hasAvailableModelConfigs();
    if (!hasConfigs) {
      throw new Error(
        '未找到可用的AI模型配置。请前往"设置"或"模型配置"页面添加您的AI服务配置（如OpenAI、Claude、Gemini等）。'
      );
    }
    return true;
  }

  // 章节大纲生成
  async generateChapterOutline(projectId, chapterData) {
    // 检查模型配置可用性
    await this.checkModelConfigAvailability();
    
    // 获取选择的模型配置
    const modelConfig = await this.getSelectedModelConfig();
    
    return this.request('/chapter-outline', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        chapter_number: chapterData.chapter_number || 1,
        user_requirements: chapterData.user_requirements || chapterData.current_content || '',
        model_config_id: modelConfig.id
      })
    });
  }

  // 章节草稿生成
  async generateChapterDraft(projectId, outline) {
    // 检查模型配置可用性
    await this.checkModelConfigAvailability();
    
    // 获取选择的模型配置
    const modelConfig = await this.getSelectedModelConfig();
    
    return this.request('/chapter-draft', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        chapter_outline: outline,
        model_config_id: modelConfig.id
      })
    });
  }

  // 角色对话生成
  async generateCharacterDialogue(projectId, characters, context) {
    // 检查模型配置可用性
    await this.checkModelConfigAvailability();
    
    // 获取选择的模型配置
    const modelConfig = await this.getSelectedModelConfig();
    
    return this.request('/character-dialogue', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        character_names: characters,
        situation: context,
        model_config_id: modelConfig.id
      })
    });
  }

  // 情节发展建议
  async getPlotSuggestions(projectId, currentChapter) {
    // 检查模型配置可用性
    await this.checkModelConfigAvailability();
    
    // 获取选择的模型配置
    const modelConfig = await this.getSelectedModelConfig();
    
    return this.request('/plot-suggestions', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        current_chapter_content: currentChapter.content || currentChapter || '',
        model_config_id: modelConfig.id
      })
    });
  }

  // AI智能体对话
  async chatWithAI(projectId, message, history = []) {
    // 检查模型配置可用性
    await this.checkModelConfigAvailability();
    
    // 获取选择的模型配置
    const modelConfig = await this.getSelectedModelConfig();
    
    return this.request('/chat', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        message: message,
        history: history,
        model_config_id: modelConfig.id
      })
    });
  }

  // AI智能体对话 - 流式输出
  async chatWithAIStream(projectId, message, history = [], onChunk, onComplete) {
    // 检查模型配置可用性
    await this.checkModelConfigAvailability();
    
    // 获取选择的模型配置
    const modelConfig = await this.getSelectedModelConfig();
    
    const response = await fetch(`${this.baseURL}/chat-stream`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        project_id: projectId,
        message: message,
        history: history,
        model_config_id: modelConfig.id
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || 'AI服务请求失败');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              if (onComplete) onComplete();
              return;
            }
            // 加强空内容过滤：检查数据是否存在、不是错误消息、且不为空白
            if (data && data.trim() && !data.startsWith('错误:')) {
              if (onChunk) onChunk(data);
            }
          }
        }
      }
    } catch (error) {
      console.error('流式输出错误:', error);
      throw error;
    }
  }

  // 内容优化
  async optimizeContent(projectId, content, optimizationType = 'general') {
    // 检查模型配置可用性
    await this.checkModelConfigAvailability();
    
    // 获取选择的模型配置
    const modelConfig = await this.getSelectedModelConfig();
    
    return this.request('/optimize-content', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        content: content,
        optimization_type: optimizationType,
        model_config_id: modelConfig.id
      })
    });
  }

  // 创意生成
  async generateCreativeIdeas(projectId, prompt, category = 'general') {
    // 检查模型配置可用性
    await this.checkModelConfigAvailability();
    
    // 获取选择的模型配置
    const modelConfig = await this.getSelectedModelConfig();
    
    return this.request('/creative-ideas', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        prompt: prompt,
        category: category,
        model_config_id: modelConfig.id
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
export { getAvailableModelConfigs, hasAvailableModelConfigs, getDefaultModelConfig };
export default aiService;