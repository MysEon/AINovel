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
    const response = await fetch(`${API_BASE_URL}/model-configs/`, {
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
    const response = await fetch(`${API_BASE_URL}/model-configs/`, {
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
    this.loadSelectedModelConfig(); // 启动时加载持久化的配置
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
    // 持久化到localStorage
    this.saveSelectedModelConfig(configId);
  }

  // 从localStorage加载保存的模型配置ID
  loadSelectedModelConfig() {
    try {
      const savedConfigId = localStorage.getItem('ainovel_selected_model_config');
      if (savedConfigId) {
        const configId = parseInt(savedConfigId, 10);
        if (!isNaN(configId)) {
          this.selectedModelConfigId = configId;
        }
      }
    } catch (error) {
      console.warn('加载AI模型配置失败:', error);
    }
  }

  // 保存选中的模型配置ID到localStorage
  saveSelectedModelConfig(configId) {
    try {
      if (configId && typeof configId === 'number') {
        localStorage.setItem('ainovel_selected_model_config', configId.toString());
      } else if (configId === null || configId === undefined) {
        localStorage.removeItem('ainovel_selected_model_config');
      }
    } catch (error) {
      console.error('保存AI模型配置失败:', error);
    }
  }

  // 清除保存的模型配置
  clearSelectedModelConfig() {
    this.selectedModelConfigId = null;
    try {
      localStorage.removeItem('ainovel_selected_model_config');
    } catch (error) {
      console.error('清除AI模型配置失败:', error);
    }
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
  async chatWithAI(projectId, message, history = [], promptTemplateId = null) {
    // 检查模型配置可用性
    await this.checkModelConfigAvailability();
    
    // 获取选择的模型配置
    const modelConfig = await this.getSelectedModelConfig();
    
    const requestBody = {
      project_id: projectId,
      message: message,
      history: history,
      model_config_id: modelConfig.id
    };
    
    // 如果指定了提示词模板，添加到请求中
    if (promptTemplateId) {
      requestBody.prompt_template_id = promptTemplateId;
    }
    
    return this.request('/chat', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });
  }

  // AI智能体对话 - 流式输出
  async chatWithAIStream(projectId, message, history = [], onChunk, onComplete, promptTemplateId = null) {
    // 检查模型配置可用性
    await this.checkModelConfigAvailability();
    
    // 获取选择的模型配置
    const modelConfig = await this.getSelectedModelConfig();
    
    const requestBody = {
      project_id: projectId,
      message: message,
      history: history,
      model_config_id: modelConfig.id
    };
    
    // 如果指定了提示词模板，添加到请求中
    if (promptTemplateId) {
      requestBody.prompt_template_id = promptTemplateId;
    }
    
    const response = await fetch(`${this.baseURL}/chat-stream`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || 'AI服务请求失败');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let processedChunks = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // 处理剩余的buffer内容 - 这是关键的修复
          if (buffer.trim()) {
            console.log('🔍 [AI Stream Debug] 处理最后的buffer内容:', buffer);
            // 直接处理剩余内容，不依赖行分割
            const lines = buffer.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  console.log('🔍 [AI Stream Debug] 接收到[DONE]信号');
                  if (onComplete) onComplete();
                  return;
                }
                if (data && data !== null && data !== undefined && !data.startsWith('错误:')) {
                  console.log('🔍 [AI Stream Debug] 最终处理剩余数据:', data);
                  if (onChunk) onChunk(data);
                }
              } else if (line.trim() && !line.startsWith('data: ') && line !== '[DONE]') {
                // 处理不以data:开头的纯文本内容
                console.log('🔍 [AI Stream Debug] 处理纯文本内容:', line.trim());
                if (onChunk) onChunk(line.trim());
              }
            }
          }
          console.log(`🔍 [AI Stream Debug] 流式输出完成，共处理 ${processedChunks} 个chunk`);
          if (onComplete) onComplete();
          break;
        }

        // 解码新的数据块
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // 按行分割处理
        let lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后一个可能不完整的行

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              if (onComplete) onComplete();
              return;
            }
            
            processedChunks++;
            console.log('🔍 [AI Stream Debug] 接收到chunk:', {
              chunkNumber: processedChunks,
              rawData: data,
              dataLength: data.length,
              isEmpty: data === '',
              charCodes: [...data].slice(0, 10).map(c => `${c}(${c.charCodeAt(0)})`).join(', ')
            });
            
            if (data && data !== null && data !== undefined && !data.startsWith('错误:')) {
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

  // 安全地按行分割文本，确保不会在多字节字符中间分割
  safeSplitLines(text) {
    const lines = [];
    let start = 0;
    
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\n') {
        lines.push(text.slice(start, i));
        start = i + 1;
      }
    }
    
    // 添加最后一行（如果没有以换行符结尾）
    if (start < text.length) {
      lines.push(text.slice(start));
    }
    
    return lines;
  }
}

export const aiService = new AIService();
export { getAvailableModelConfigs, hasAvailableModelConfigs, getDefaultModelConfig };
export default aiService;