/**
 * 提示词模板服务
 * 处理提示词模板相关的API调用
 */

const API_BASE_URL = '/api';

// 获取认证头
const getAuthHeaders = () => {
  let token = localStorage.getItem('ainovel_token');
  
  if (token && typeof token === 'string') {
    token = token.replace(/^"|"$/g, '');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

class PromptService {
  constructor() {
    this.baseURL = `${API_BASE_URL}/prompt-templates`;
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || '请求失败');
    }

    return response.json();
  }

  // 获取提示词模板列表
  async getTemplates(filters = {}) {
    const params = new URLSearchParams();
    
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    if (typeof filters.include_system === 'boolean') {
      params.append('include_system', filters.include_system);
    }
    if (typeof filters.only_active === 'boolean') {
      params.append('only_active', filters.only_active);
    }

    const query = params.toString();
    return this.request(query ? `/?${query}` : '/');
  }

  // 获取分类列表
  async getCategories() {
    return this.request('/categories');
  }

  // 获取单个模板
  async getTemplate(id) {
    return this.request(`/${id}`);
  }

  // 创建模板
  async createTemplate(templateData) {
    return this.request('/', {
      method: 'POST',
      body: JSON.stringify(templateData)
    });
  }

  // 更新模板
  async updateTemplate(id, templateData) {
    return this.request(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(templateData)
    });
  }

  // 删除模板
  async deleteTemplate(id) {
    return this.request(`/${id}`, {
      method: 'DELETE'
    });
  }

  // 复制模板
  async copyTemplate(id) {
    return this.request(`/${id}/copy`, {
      method: 'POST'
    });
  }

  // 使用模板（记录使用次数）
  async useTemplate(id) {
    return this.request(`/${id}/use`, {
      method: 'POST'
    });
  }

  // 初始化系统模板
  async initializeSystemTemplates() {
    return this.request('/initialize-system-templates', {
      method: 'POST'
    });
  }

  // 预览模板
  async previewTemplate(id, variables = {}) {
    const params = new URLSearchParams();
    if (Object.keys(variables).length > 0) {
      params.append('variables', JSON.stringify(variables));
    }
    
    const query = params.toString();
    return this.request(`/${id}/preview${query ? `?${query}` : ''}`);
  }

  // 渲染模板（简单的模板变量替换）
  renderTemplate(template, variables = {}) {
    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }
    return rendered;
  }

  // 提取模板中的变量
  extractVariables(template) {
    const regex = /\{\{\s*([^}]+)\s*\}\}/g;
    const variables = [];
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      const variable = match[1].trim();
      if (!variables.includes(variable)) {
        variables.push(variable);
      }
    }
    
    return variables;
  }

  // 验证模板格式
  validateTemplate(template) {
    const errors = [];
    
    if (!template || template.trim().length === 0) {
      errors.push('模板内容不能为空');
      return errors;
    }

    // 检查变量格式是否正确
    const regex = /\{\{[^}]*\}\}/g;
    const matches = template.match(regex);
    
    if (matches) {
      matches.forEach(match => {
        // 检查是否有未闭合的花括号
        const openBraces = (match.match(/\{/g) || []).length;
        const closeBraces = (match.match(/\}/g) || []).length;
        
        if (openBraces !== closeBraces || openBraces !== 2) {
          errors.push(`变量格式错误: ${match}`);
        }
        
        // 检查变量名是否为空
        const variableName = match.replace(/[{}]/g, '').trim();
        if (!variableName) {
          errors.push(`变量名不能为空: ${match}`);
        }
      });
    }
    
    return errors;
  }

  // 获取模板的统计信息
  getTemplateStats(templates) {
    return {
      total: templates.length,
      system: templates.filter(t => t.is_system).length,
      user: templates.filter(t => !t.is_system).length,
      active: templates.filter(t => t.is_active).length,
      inactive: templates.filter(t => !t.is_active).length,
      categories: [...new Set(templates.map(t => t.category))]
    };
  }
}

export const promptService = new PromptService();
export default promptService;