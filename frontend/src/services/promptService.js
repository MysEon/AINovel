/**
 * 提示词模板服务
 * 处理提示词模板相关的API调用
 */
import { api } from './core/apiClient.js';

class PromptService {
  // 获取提示词模板列表
  getTemplates(filters = {}) {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    if (typeof filters.include_system === 'boolean')
      params.append('include_system', filters.include_system);
    if (typeof filters.only_active === 'boolean')
      params.append('only_active', filters.only_active);
    const query = params.toString();
    return api.get(query ? `/prompt-templates/?${query}` : '/prompt-templates/');
  }

  // 获取分类列表
  getCategories() {
    return api.get('/prompt-templates/categories');
  }

  // 获取单个模板
  getTemplate(id) {
    return api.get(`/prompt-templates/${id}`);
  }

  // 创建模板
  createTemplate(templateData) {
    return api.post('/prompt-templates/', templateData);
  }

  // 更新模板
  updateTemplate(id, templateData) {
    return api.put(`/prompt-templates/${id}`, templateData);
  }

  // 删除模板
  deleteTemplate(id) {
    return api.delete(`/prompt-templates/${id}`);
  }

  // 复制模板
  copyTemplate(id) {
    return api.post(`/prompt-templates/${id}/copy`);
  }

  // 使用模板（记录使用次数）
  useTemplate(id) {
    return api.post(`/prompt-templates/${id}/use`);
  }

  // 初始化系统模板
  initializeSystemTemplates() {
    return api.post('/prompt-templates/initialize-system-templates');
  }

  // 预览模板
  previewTemplate(id, variables = {}) {
    const params = new URLSearchParams();
    if (Object.keys(variables).length > 0) {
      params.append('variables', JSON.stringify(variables));
    }
    const query = params.toString();
    return api.get(`/prompt-templates/${id}/preview${query ? `?${query}` : ''}`);
  }

  // 渲染模板（纯前端变量替换）
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
      if (!variables.includes(variable)) variables.push(variable);
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
    const regex = /\{\{[^}]*\}\}/g;
    const matches = template.match(regex);
    if (matches) {
      matches.forEach(match => {
        const openBraces = (match.match(/\{/g) || []).length;
        const closeBraces = (match.match(/\}/g) || []).length;
        if (openBraces !== closeBraces || openBraces !== 2)
          errors.push(`变量格式错误: ${match}`);
        const variableName = match.replace(/[{}]/g, '').trim();
        if (!variableName) errors.push(`变量名不能为空: ${match}`);
      });
    }
    return errors;
  }

  // 获取模板统计信息（纯前端计算）
  getTemplateStats(templates) {
    return {
      total: templates.length,
      system: templates.filter(t => t.is_system).length,
      user: templates.filter(t => !t.is_system).length,
      active: templates.filter(t => t.is_active).length,
      inactive: templates.filter(t => !t.is_active).length,
      categories: [...new Set(templates.map(t => t.category))],
    };
  }
}

export const promptService = new PromptService();
export default promptService;