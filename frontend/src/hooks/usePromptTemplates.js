import { useState } from 'react';
import promptService from '../services/promptService';

const usePromptTemplates = ({ addNotification }) => {
  const [promptTemplates, setPromptTemplates] = useState([]);
  const [selectedPromptTemplate, setSelectedPromptTemplate] = useState(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  const fetchPromptTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      // 获取AI对话分类的模板
      const templates = await promptService.getTemplates({ category: 'chat', include_system: true });
      setPromptTemplates(templates);

      // 选择默认模板（系统模板中的第一个）
      const systemTemplate = templates.find(t => t.is_system && t.category === 'chat');
      if (systemTemplate) {
        setSelectedPromptTemplate(systemTemplate);
      }
    } catch (error) {
      console.error('Error fetching prompt templates:', error);
      addNotification({
        message: '获取提示词模板失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  return {
    promptTemplates,
    selectedPromptTemplate,
    isLoadingTemplates,
    fetchPromptTemplates,
    setSelectedPromptTemplate
  };
};

export default usePromptTemplates;
