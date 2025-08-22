import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FaRobot, FaFont, FaSave, FaUpload, FaBook, FaPlus, FaLockOpen, FaLayerGroup, FaSpinner, FaMagic, FaLightbulb, FaUsers, FaExchangeAlt, FaUser, FaCog } from 'react-icons/fa';
import { useNotification } from '../NotificationManager';
import { getChapters, updateChapter, publishChapter, createChapter, getChapter, batchUpdateChapterStatus, batchPublishChapters } from '../../services/chapterService';
import { aiService, getAvailableModelConfigs } from '../../services/aiService';
import BatchChapterPublishDialog from '../BatchChapterPublishDialog';
import { Layout, Button, Space, Select, Tag, Tooltip, Spin, Input, Card, Row, Col, Divider, Avatar, Dropdown, Menu } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css'; // 代码高亮样式
import './WritingEditorSimple.css';
import useWritingPersistentState from '../../hooks/useWritingPersistentState';

const { Sider, Content } = Layout;
const { TextArea } = Input;
const { Option } = Select;

const WritingEditor = ({ projectId, initialChapterId, onChapterChange, onProjectsChange }) => {
  // 先声明基本状态
  const [currentChapter, setCurrentChapter] = useState(null);
  const [content, setContent] = useState('');
  const [chapters, setChapters] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isEditorLocked, setIsEditorLocked] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [showBatchPublish, setShowBatchPublish] = useState(false);
  const [publishButtonPosition, setPublishButtonPosition] = useState(null);
  const [modelConfigs, setModelConfigs] = useState([]);
  const [selectedModelConfig, setSelectedModelConfig] = useState(null);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const { addNotification, showConfirmDialog } = useNotification();

  // 使用增强型持久化状态管理（现在 currentChapter 已经声明了）
  const {
    writingState,
    setWritingState,
    aiChatState,
    setAiChatState,
    draftState,
    setDraftState,
    isRestoring,
    restorationProgress
  } = useWritingPersistentState(projectId, currentChapter?.id);

  // 从持久化状态中获取写作相关状态，提供默认值以防状态未恢复
  const aiAssisted = writingState?.aiAssisted ?? false;
  const aiMode = writingState?.aiMode ?? 'optimize';
  const layoutMode = writingState?.layoutMode ?? 'left';

  // 当 currentChapter 改变时，也更新 content 和锁定状态
  useEffect(() => {
    if (currentChapter) {
      setContent(currentChapter.content || '');
      setIsEditorLocked(currentChapter.status === 'published');
    } else {
      setContent('');
      setIsEditorLocked(false);
    }
  }, [currentChapter]);

  // 获取项目章节数据和模型配置
  useEffect(() => {
    if (projectId) {
      fetchChapters();
      fetchModelConfigs();
    }
  }, [projectId]);

  // 处理模型配置选择
  const handleModelConfigChange = (configId) => {
    const config = modelConfigs.find(c => c.id === configId);
    if (config) {
      setSelectedModelConfig(config);
      aiService.setSelectedModelConfigId(configId);
      
      // 持久化选中的模型配置
      setWritingState(prevState => ({
        ...prevState,
        selectedModelConfigId: configId
      }));
      
      addNotification({
        message: `已切换到 ${config.name} 模型`,
        type: 'success',
        duration: 2000
      });
    }
  };

  const fetchModelConfigs = async () => {
    setIsLoadingConfigs(true);
    try {
      console.log('WritingEditor: 开始获取模型配置...');
      const configs = await getAvailableModelConfigs();
      console.log('WritingEditor: 获取到的模型配置:', configs);
      setModelConfigs(configs);
      
      // 如果有配置且没有选择过配置，优先从持久化状态恢复，否则选择第一个
      if (configs.length > 0) {
        const savedConfigId = writingState?.selectedModelConfigId;
        let configToSelect = null;
        
        if (savedConfigId) {
          configToSelect = configs.find(c => c.id === savedConfigId);
        }
        
        if (!configToSelect && !selectedModelConfig) {
          configToSelect = configs[0];
        }
        
        if (configToSelect) {
          console.log('WritingEditor: 选择模型配置:', configToSelect);
          setSelectedModelConfig(configToSelect);
          aiService.setSelectedModelConfigId(configToSelect.id);
        }
      }
    } catch (error) {
      console.error('WritingEditor: Error fetching model configs:', error);
      // 只在非401错误时显示通知
      if (error.message && !error.message.includes('401')) {
        addNotification({
          message: '获取AI模型配置失败: ' + error.message,
          type: 'error',
          duration: 3000
        });
      }
    } finally {
      setIsLoadingConfigs(false);
    }
  };

  const fetchChapters = async () => {
    try {
      console.log('Fetching chapters for projectId:', projectId);
      const chaptersData = await getChapters(projectId);
      console.log('Received chapters data:', chaptersData);
      setChapters(chaptersData);

      let chapterToSet = null;

      // 1. 优先从 initialChapterId 加载
      if (initialChapterId) {
        chapterToSet = chaptersData.find(ch => ch.id === initialChapterId);
      }

      // 2. 如果没有，则使用默认逻辑
      if (!chapterToSet) {
        const lastPublished = chaptersData
          .filter(chapter => chapter.status === 'published')
          .sort((a, b) => b.chapter_number - a.chapter_number)[0];
        
        if (lastPublished) {
          const nextChapterNumber = lastPublished.chapter_number + 1;
          const nextChapter = chaptersData.find(ch => ch.chapter_number === nextChapterNumber);
          if (nextChapter) {
            chapterToSet = nextChapter;
          } else {
            // 如果没有下一章，就显示最后一章（已发布的章节）
            chapterToSet = lastPublished;
          }
        } else if (chaptersData.length > 0) {
          // 如果没有已发布章节，选择第一个草稿章节
          const draftChapters = chaptersData.filter(ch => ch.status === 'draft');
          chapterToSet = draftChapters.length > 0 ? draftChapters[0] : chaptersData[0];
        } else {
          // 如果没有任何章节，创建一个默认的
          chapterToSet = { id: null, title: '第一章', chapter_number: 1, status: 'draft' };
        }
      }
      
      console.log('Setting current chapter:', chapterToSet);
      setCurrentChapter(chapterToSet);

    } catch (error) {
      console.error('Error fetching chapters:', error);
      addNotification({
        message: '获取章节列表失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
    }
  };

  // 保存功能
  const saveContent = useCallback(async () => {
    if (isSaving || !currentChapter) return;
    
    setIsSaving(true);
    try {
      // 调用后端API保存内容
      const chapterData = {
        content: content,
        title: currentChapter.title,
        outline: currentChapter.outline || '',
        order_index: currentChapter.order_index,
        status: currentChapter.status
      };
      
      const updatedChapter = await updateChapter(currentChapter.id, chapterData);
      
      // 使用全局通知组件显示保存成功的通知
      addNotification({
        message: '内容已保存',
        type: 'success',
        duration: 3000
      });
      
      // 更新当前章节数据
      setCurrentChapter(updatedChapter);
      
      // 更新章节列表中的对应章节
      setChapters(prevChapters => 
        prevChapters.map(chapter => 
          chapter.id === updatedChapter.id ? updatedChapter : chapter
        )
      );
    } catch (error) {
      addNotification({
        message: '保存失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, content, currentChapter, addNotification]);

  // 发布功能
  const publishChapterContent = useCallback(async () => {
    if (isPublishing || !currentChapter) return;
    
    setIsPublishing(true);
    try {
      // 先保存当前内容
      const chapterData = {
        content: content,
        title: currentChapter.title,
        outline: currentChapter.outline || '',
        order_index: currentChapter.order_index,
        status: 'published'
      };
      
      const updatedChapter = await updateChapter(currentChapter.id, chapterData);
      
      // 使用全局通知组件显示发布成功的通知
      addNotification({
        message: '章节已发布',
        type: 'success',
        duration: 3000
      });
      
      // 重新获取最新的章节数据以确保状态同步
      const latestChapters = await getChapters(projectId);
      setChapters(latestChapters);
      
      // 重新获取当前章节的最新状态
      const latestChapter = await getChapter(currentChapter.id);
      setCurrentChapter(latestChapter);
      
      // 通知父组件更新项目状态
      if (onProjectsChange) {
        onProjectsChange();
      }
    } catch (error) {
      addNotification({
        message: '发布失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
    } finally {
      setIsPublishing(false);
    }
  }, [isPublishing, content, currentChapter, addNotification, projectId, onProjectsChange]);

  // Ctrl+S 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveContent();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [saveContent]);

  const handleContentChange = (newContent) => {
    setContent(newContent);
  };

  const toggleAiAssisted = () => {
    const newValue = !aiAssisted;
    setWritingState(prevState => ({
      ...prevState,
      aiAssisted: newValue
    }));
  };

  const handleAiModeChange = (mode) => {
    setWritingState(prevState => ({
      ...prevState,
      aiMode: mode
    }));
  };

  const toggleLayout = () => {
    const newLayoutMode = layoutMode === 'left' ? 'right' : 'left';
    setWritingState(prevState => ({
      ...prevState,
      layoutMode: newLayoutMode
    }));
  };

  const handleChapterChange = async (e) => {
    const selectedId = e.target.value;
    if (selectedId) {
      try {
        const chapterId = parseInt(selectedId);
        const chapterDetails = await getChapter(chapterId);
        setCurrentChapter(chapterDetails);
        if (onChapterChange) {
          onChapterChange(chapterDetails.id);
        }
      } catch (error) {
        addNotification({
          message: '获取章节详情失败: ' + error.message,
          type: 'error',
          duration: 3000
        });
      }
    }
  };

  const handleUnlockClick = () => {
    if (!currentChapter || !projectId) return;

    showConfirmDialog({
      title: '确认解锁章节',
      message: `您确定要解锁章节 "${currentChapter.title}" 吗？这将导致该章节及其之后的所有已发布章节状态变更为"草稿"，以便您可以重新编辑。`,
      type: 'warning',
      showResultNotification: true,
      successMessage: '章节已成功解锁，您可以开始编辑了',
      errorMessage: '解锁失败',
      onConfirm: async () => {
        try {
            await batchUpdateChapterStatus({
              project_id: projectId,
              from_order_index: currentChapter.chapter_number,
              new_status: 'draft'
            });
            
            await fetchChapters(); // Re-fetch all chapters to update list statuses
            
            // Re-fetch current chapter to get its updated status and unlock the editor
            const reloadedChapter = await getChapter(currentChapter.id);
            setCurrentChapter(reloadedChapter);

            if (onProjectsChange) {
              onProjectsChange();
            }
        } catch (error) {
          // The component will show the generic errorMessage.
          // Throwing the original error is good for debugging in the console.
          throw new Error(`解锁失败: ${error.message}`);
        }
      }
    });
  };

  // 开启新章
  const handleStartNewChapter = async (title) => {
    if (!title.trim() || !projectId) {
      throw new Error('章节标题不能为空或项目ID无效');
    }
    
    const newChapterData = {
      title: title,
      content: '',
      outline: '',
      status: 'draft'
    };
    
    try {
      const newChapter = await createChapter(projectId, newChapterData);
      
      setChapters(prev => [...prev, newChapter].sort((a, b) => a.chapter_number - b.chapter_number));
      setCurrentChapter(newChapter);
      setNewChapterTitle('');

      if (onProjectsChange) {
        onProjectsChange();
      }
    } catch (error) {
      console.error('创建章节失败:', error);
      throw error; // 重新抛出错误，让NotificationManager处理
    }
  };

  // 处理批量发布
  const handleBatchPublish = async (chaptersToPublish, onProgress) => {
    try {
      const chapterIds = chaptersToPublish.map(ch => ch.id);
      const results = await batchPublishChapters(projectId, chapterIds, onProgress);
      
      // 刷新章节列表
      await fetchChapters();
      
      // 如果当前章节在发布的章节中，更新其状态
      const publishedChapterIds = results.results
        .filter(r => r.success)
        .map(r => r.chapterId);
      
      if (currentChapter && publishedChapterIds.includes(currentChapter.id)) {
        const updatedChapter = await getChapter(currentChapter.id);
        setCurrentChapter(updatedChapter);
      }
      
      // 通知父组件更新项目状态
      if (onProjectsChange) {
        onProjectsChange();
      }
      
      // 显示结果通知
      if (results.errorCount === 0) {
        addNotification({
          message: `成功发布 ${results.successCount} 个章节`,
          type: 'success',
          duration: 3000
        });
      } else {
        addNotification({
          message: `发布完成：成功 ${results.successCount} 个，失败 ${results.errorCount} 个`,
          type: 'warning',
          duration: 5000
        });
      }
      
    } catch (error) {
      addNotification({
        message: '批量发布失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
      throw error;
    }
  };

  // 打开批量发布对话框
  const handleBatchPublishClick = (event) => {
    const rect = event.target.getBoundingClientRect();
    setPublishButtonPosition({
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
      width: rect.width,
      height: rect.height
    });
    setShowBatchPublish(true);
  };

  const getChapterDisplay = () => {
    return currentChapter ? currentChapter.title : '未选择章节';
  };

  // 错误边界检查
  if (!projectId) {
    return (
      <div className="writing-editor">
        <div className="editor-content">
          <div className="error-notice">
            <h3>错误</h3>
            <p>项目ID未提供，请返回项目选择页面。</p>
          </div>
        </div>
      </div>
    );
  }

  // 状态恢复加载界面
  if (isRestoring && restorationProgress < 100) {
    return (
      <div className="writing-editor">
        <div className="state-restoration-overlay">
          <div className="restoration-content">
            <div className="loading-spinner">
              <Spin size="large" />
            </div>
            <div className="restoration-text">
              正在恢复写作状态...
            </div>
            <div className="restoration-progress">
              <div 
                className="progress-bar" 
                style={{ 
                  width: `${restorationProgress}%`,
                  height: '4px',
                  backgroundColor: '#1890ff',
                  borderRadius: '2px',
                  transition: 'width 0.3s ease'
                }} 
              />
            </div>
            <div className="restoration-details" style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              恢复AI设置、聊天记录和编辑器状态
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="writing-editor">
      <div className="editor-content">
        {chapters.length === 0 ? (
          <div className="empty-chapters-notice">
            <h3>欢迎开始创作！</h3>
            <p>您的项目目前还没有章节。</p>
            <button className="create-chapter-button" onClick={() => {
              showConfirmDialog({
                title: '创建第一个章节',
                message: '请输入章节标题：',
                showInput: true,
                inputValue: '',
                onInputChange: (value) => {},
                inputPlaceholder: '例如：第一章：开始',
                required: true,
                type: 'info',
                showResultNotification: true,
                successMessage: '第一个章节已创建',
                errorMessage: '创建第一个章节失败',
                onConfirm: handleStartNewChapter
              });
            }}>
              <FaBook /> 创建第一个章节
            </button>
            </div>
        ) : aiAssisted ? (
          <AiWritingInterface
            content={content}
            onContentChange={handleContentChange}
            readOnly={isEditorLocked}
            projectId={projectId}
            currentChapter={currentChapter}
            layoutMode={layoutMode}
            modelConfigs={modelConfigs}
            selectedModelConfig={selectedModelConfig}
            onModelConfigChange={handleModelConfigChange}
            aiChatState={aiChatState}
            setAiChatState={setAiChatState}
          />
        ) : (
          <RichTextEditor 
            content={content} 
            onContentChange={handleContentChange} 
            readOnly={isEditorLocked}
          />
        )}
      </div>
      <div className="editor-footer">
        <div className="footer-left">
          <div className="chapter-selector">
            <label>当前章节:</label>
            <select value={currentChapter?.id || ''} onChange={handleChapterChange}>
              {chapters.map(chapter => (
                <option key={chapter.id} value={chapter.id}>
                  第{chapter.chapter_number}章 {chapter.title} ({chapter.status === 'published' ? '已发布' : '草稿'})
                </option>
              ))}
            </select>
            {currentChapter && (
              <span className={`chapter-status ${currentChapter.status}`}>
                {currentChapter.status === 'published' ? '已发布' : '草稿'}
              </span>
            )}
            {isEditorLocked && (
              <button className="action-btn unlock-btn" onClick={handleUnlockClick} title="解锁">
                <FaLockOpen />
              </button>
            )}
          </div>
          <button 
            className={`publish-button ${currentChapter?.status === 'published' ? 'published' : ''}`}
            onClick={publishChapterContent}
            disabled={isPublishing || !currentChapter || currentChapter.status === 'published'}
            title={currentChapter?.status === 'published' ? "章节已发布" : "发布章节"}
          >
            <FaUpload />
            <span>{currentChapter?.status === 'published' ? '已发布' : (isPublishing ? '发布中...' : '发布')}</span>
          </button>
          <button 
            className="batch-publish-button"
            onClick={handleBatchPublishClick}
            disabled={!currentChapter}
            title="批量发布多个章节"
          >
            <FaLayerGroup />
            <span>批量发布</span>
          </button>
          <button 
            className="publish-button"
            onClick={() => {
              showConfirmDialog({
                title: '开启新章节',
                message: '请输入新章节的标题：',
                showInput: true,
                inputValue: newChapterTitle,
                onInputChange: (value) => setNewChapterTitle(value),
                inputPlaceholder: '例如：新的征程',
                required: true,
                type: 'info',
                showResultNotification: true,
                successMessage: '新章节已开启',
                errorMessage: '开启新章失败',
                onConfirm: handleStartNewChapter
              });
            }}
            title="开启一个全新的章节"
          >
            <FaPlus />
            <span>开启新章</span>
          </button>
        </div>
        <div className="footer-right">
          {aiAssisted && (
            <>
              <div className="ai-mode-selector">
                <span className="ai-mode-label">AI模式:</span>
                <div className="ai-mode-buttons">
                  <button
                    className={`ai-mode-button ${aiMode === 'optimize' ? 'active' : ''}`}
                    onClick={() => handleAiModeChange('optimize')}
                  >
                    辅助优化型
                  </button>
                  <button
                    className={`ai-mode-button ${aiMode === 'takeover' ? 'active' : ''}`}
                    onClick={() => handleAiModeChange('takeover')}
                  >
                    全面接管型
                  </button>
                </div>
              </div>
              <Tooltip title={layoutMode === 'left' ? '切换到右侧聊天' : '切换到左侧聊天'}>
                <Button
                  type="default"
                  icon={<FaExchangeAlt />}
                  onClick={toggleLayout}
                  size="small"
                  className="layout-toggle-button"
                >
                  布局
                </Button>
              </Tooltip>
            </>
          )}
          <button 
            className="save-button"
            onClick={saveContent}
            disabled={isSaving}
            title="保存内容 (Ctrl+S)"
          >
            <FaSave />
            <span>{isSaving ? '保存中...' : '保存'}</span>
          </button>
          <button 
            className={`ai-toggle-button ${aiAssisted ? 'active' : ''}`}
            onClick={toggleAiAssisted}
            aria-label={aiAssisted ? "关闭AI辅助" : "开启AI辅助"}
          >
            {aiAssisted ? <FaRobot /> : <FaFont />}
            <span>{aiAssisted ? "AI辅助中" : "AI辅助"}</span>
          </button>
        </div>
      </div>

      {/* 批量发布对话框 */}
      {showBatchPublish && (
        <BatchChapterPublishDialog
          projectId={projectId}
          currentChapter={currentChapter}
          chapters={chapters}
          onClose={() => setShowBatchPublish(false)}
          onPublish={handleBatchPublish}
          triggerPosition={publishButtonPosition}
        />
      )}

      {/* Unlock confirmation dialog is now handled globally by NotificationManager */}
    </div>
  );
};


const RichTextEditor = ({ content, onContentChange, readOnly }) => {
  const handleChange = (e) => {
    if (!readOnly) {
      onContentChange(e.target.value);
    }
  };

  return (
    <div className="rich-text-editor">
      {readOnly && <div className="editor-lock-overlay">编辑区已锁定</div>}
      <textarea
        className={`content-textarea ${readOnly ? 'locked' : ''}`}
        value={content}
        onChange={handleChange}
        placeholder="在这里开始你的创作..."
        readOnly={readOnly}
      />
    </div>
  );
};

const AiWritingInterface = ({ content, onContentChange, readOnly, projectId, currentChapter, layoutMode, modelConfigs = [], selectedModelConfig = null, onModelConfigChange, aiChatState, setAiChatState }) => {
  // 从持久化状态恢复聊天记录，如果没有则使用默认消息
  const [messages, setMessages] = useState(() => {
    if (aiChatState?.messages && aiChatState.messages.length > 0) {
      return aiChatState.messages;
    }
    return [
      { id: 1, role: 'assistant', content: '你好！我是你的AI写作助手。我可以帮助你进行创意构思、内容优化、情节建议等。有什么需要帮助的吗？' }
    ];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesContainerRef = useRef(null);

  // 当章节变化或aiChatState变化时，更新聊天记录
  useEffect(() => {
    if (currentChapter?.id && aiChatState?.messages) {
      // 如果有持久化的消息记录，使用它
      if (aiChatState.messages.length > 0) {
        setMessages(aiChatState.messages);
      } else {
        // 如果没有，重置为默认消息
        const defaultMessages = [
          { id: 1, role: 'assistant', content: '你好！我是你的AI写作助手。我可以帮助你进行创意构思、内容优化、情节建议等。有什么需要帮助的吗？' }
        ];
        setMessages(defaultMessages);
        // 持久化默认消息
        if (setAiChatState) {
          setAiChatState({ messages: defaultMessages });
        }
      }
    }
  }, [currentChapter?.id, aiChatState, setAiChatState]);

  // 消息变化时持久化到存储
  useEffect(() => {
    if (currentChapter?.id && messages.length > 1 && setAiChatState) {
      // 避免只有默认消息时的重复持久化
      setAiChatState({ messages });
    }
  }, [messages, currentChapter?.id, setAiChatState]);

  const handleContentChange = (e) => {
    onContentChange(e.target.value);
  };

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  // 当消息变化时自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const handleSend = async () => {
    if (input.trim() === '' || isLoading) return;

    // 检查是否有可用的模型配置
    if (modelConfigs.length === 0) {
      const errorMessage = {
        id: messages.length + 1,
        role: 'assistant',
        content: '未找到可用的AI模型配置。请先在设置中添加您的AI服务配置（如OpenAI、Claude、Gemini等）。'
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    const userMessage = { id: messages.length + 1, role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // 检查是否支持流式输出
    const supportsStream = selectedModelConfig && selectedModelConfig.stream;
    
    // 立即创建AI消息显示"正在思考中"
    const aiResponseId = messages.length + 2;
    const aiResponse = {
      id: aiResponseId,
      role: 'assistant',
      content: 'AI正在思考中...',
      isThinking: true  // 统一标记为思考状态
    };
    const messagesWithThinking = [...newMessages, aiResponse];
    setMessages(messagesWithThinking);
    
    try {
      if (supportsStream) {
        // 使用流式输出
        let isFirstChunk = true;
        
        await aiService.chatWithAIStream(
          projectId,
          input,
          newMessages,  // 传入用户消息前的聊天历史
          (chunk) => {
            // 过滤空内容chunk
            if (!chunk || !chunk.trim()) {
              return; // 忽略空的chunk
            }
            
            // 更新消息内容
            setMessages(prev => prev.map(msg => 
              msg.id === aiResponseId 
                ? { 
                    ...msg, 
                    content: isFirstChunk ? chunk : msg.content + chunk,
                    isThinking: false  // 收到内容后取消思考状态
                  }
                : msg
            ));
            if (isFirstChunk) isFirstChunk = false;
          },
          () => {
            setIsLoading(false);
          }
        );
      } else {
        // 使用普通输出
        const response = await aiService.chatWithAI(projectId, input, newMessages);  // 传入用户消息前的聊天历史
        // 更新思考中的消息为实际回复
        setMessages(prev => prev.map(msg => 
          msg.id === aiResponseId 
            ? { 
                ...msg, 
                content: response.content || response.response || '抱歉，我暂时无法回复。',
                isThinking: false
              }
            : msg
        ));
        setIsLoading(false);
      }
    } catch (error) {
      // 更新现有消息显示错误信息
      setMessages(prev => prev.map(msg => 
        msg.id === aiResponseId 
          ? { 
              ...msg, 
              content: `抱歉，AI服务暂时不可用: ${error.message}`,
              isThinking: false
            }
          : msg
      ));
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAIAction = async (action) => {
    if (!currentChapter || isLoading) return;

    // 检查是否有可用的模型配置
    if (modelConfigs.length === 0) {
      const errorMessage = {
        id: messages.length + 1,
        role: 'assistant',
        content: '未找到可用的AI模型配置。请先在设置中添加您的AI服务配置（如OpenAI、Claude、Gemini等）。'
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    setIsLoading(true);
    
    // 立即创建AI消息显示"正在思考中"
    const aiResponseId = messages.length + 1;
    const aiResponse = {
      id: aiResponseId,
      role: 'assistant',
      content: 'AI正在思考中...',
      isThinking: true
    };
    const messagesWithThinking = [...messages, aiResponse];
    setMessages(messagesWithThinking);
    
    try {
      let response;
      switch (action) {
        case 'outline':
          response = await aiService.generateChapterOutline(projectId, {
            chapter_number: currentChapter.chapter_number,
            user_requirements: `章节标题: ${currentChapter.title}\n当前内容: ${content}`
          });
          break;
        case 'suggestions':
          response = await aiService.getPlotSuggestions(projectId, {
            content: content
          });
          break;
        case 'optimize':
          response = await aiService.optimizeContent(projectId, content);
          if (response.optimized_content) {
            onContentChange(response.optimized_content);
          }
          break;
        case 'ideas':
          response = await aiService.generateCreativeIdeas(projectId, '请为当前章节提供一些创意建议');
          break;
        default:
          return;
      }

      // 更新现有消息显示结果
      setMessages(prev => prev.map(msg => 
        msg.id === aiResponseId 
          ? { 
              ...msg, 
              content: response.content || response.suggestions || response.optimized_content || '操作完成',
              isThinking: false
            }
          : msg
      ));
    } catch (error) {
      // 更新现有消息显示错误
      setMessages(prev => prev.map(msg => 
        msg.id === aiResponseId 
          ? { 
              ...msg, 
              content: `${action} 操作失败: ${error.message}`,
              isThinking: false
            }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const chatSider = (
    <Sider width="45%" style={{ background: 'transparent', padding: '0 8px', height: '100%', overflow: 'hidden' }}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* AI快捷操作按钮 - 固定在顶部 */}
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>AI写作助手</span>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {selectedModelConfig && (
                  <Tag color="blue" style={{ marginRight: 8 }}>
                    {selectedModelConfig.name}
                  </Tag>
                )}
                <Dropdown
                  overlay={
                    <Menu onClick={(e) => onModelConfigChange && onModelConfigChange(parseInt(e.key))}>
                      {modelConfigs.map(config => (
                        <Menu.Item key={config.id}>
                          {config.name} ({config.model_type})
                        </Menu.Item>
                      ))}
                      {modelConfigs.length === 0 && (
                        <Menu.Item disabled>
                          <span style={{ color: '#999' }}>暂无可用模型配置</span>
                        </Menu.Item>
                      )}
                    </Menu>
                  }
                  trigger={['click']}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<FaCog />}
                    title="选择AI模型"
                    loading={false}
                  />
                </Dropdown>
              </div>
            </div>
          }
          style={{
            borderRadius: '8px 8px 0 0',
            flexShrink: 0
          }}
          bodyStyle={{ padding: '12px 16px' }}
        >
          <Space wrap>
            <Button
              icon={<FaMagic />}
              onClick={() => handleAIAction('outline')}
              disabled={isLoading || modelConfigs.length === 0}
              size="small"
            >
              大纲
            </Button>
            <Button
              icon={<FaLightbulb />}
              onClick={() => handleAIAction('suggestions')}
              disabled={isLoading || modelConfigs.length === 0}
              size="small"
            >
              建议
            </Button>
            <Button
              icon={<FaSpinner />}
              onClick={() => handleAIAction('optimize')}
              disabled={isLoading || modelConfigs.length === 0}
              size="small"
            >
              优化
            </Button>
            <Button
              icon={<FaUsers />}
              onClick={() => handleAIAction('ideas')}
              disabled={isLoading || modelConfigs.length === 0}
              size="small"
            >
              创意
            </Button>
          </Space>
          {modelConfigs.length === 0 && (
            <div style={{ marginTop: 8, color: '#999', fontSize: '12px' }}>
              请先在设置中配置AI模型
            </div>
          )}
        </Card>

        {/* 聊天消息区域 - 固定高度，可滚动 */}
        <Card 
          style={{ 
            flex: 1, 
            borderRadius: 0,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0, // 关键：允许flex子项收缩
            overflow: 'hidden' // 关键：防止内容溢出
          }}
          bodyStyle={{ 
            padding: 0, 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden' // 关键：防止内容溢出
          }}
        >
          <div
            ref={messagesContainerRef}
            className="messages-container ai-chat-container"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              minHeight: 0, // 关键：允许flex子项收缩
              maxHeight: 'calc(100vh - 350px)' // 限制最大高度，为footer和其他UI元素预留空间
            }}
          >
            {messages.map((message) => (
              <div 
                key={message.id} 
                style={{ 
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-start'
                }}
              >
                {message.role === 'assistant' && (
                  <Avatar 
                    icon={<FaRobot />} 
                    style={{ 
                      backgroundColor: '#1890ff',
                      marginRight: '8px',
                      flexShrink: 0
                    }}
                  />
                )}
                <div 
                  style={{ 
                    maxWidth: '70%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: message.role === 'user' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div 
                    style={{ 
                      padding: '12px 16px',
                      background: message.role === 'user' ? '#1890ff' : '#f5f5f5',
                      color: message.role === 'user' ? 'white' : '#333',
                      borderRadius: '18px',
                      borderBottomLeftRadius: message.role === 'assistant' ? '4px' : '18px',
                      borderBottomRightRadius: message.role === 'user' ? '4px' : '18px',
                      wordBreak: 'break-word',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  >
                    {message.role === 'assistant' && message.isThinking ? (
                      <>
                        <Spin size="small" /> AI正在思考中...
                      </>
                    ) : message.role === 'assistant' ? (
                      <div className="ai-chat-markdown">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight]}
                          components={{
                            // 自定义组件样式以适配聊天气泡
                            p: ({ children }) => <p style={{ margin: '0.5em 0', lineHeight: '1.6' }}>{children}</p>,
                            h1: ({ children }) => <h1 style={{ fontSize: '1.2em', margin: '0.5em 0', fontWeight: 'bold' }}>{children}</h1>,
                            h2: ({ children }) => <h2 style={{ fontSize: '1.1em', margin: '0.4em 0', fontWeight: 'bold' }}>{children}</h2>,
                            h3: ({ children }) => <h3 style={{ fontSize: '1.05em', margin: '0.3em 0', fontWeight: 'bold' }}>{children}</h3>,
                            ul: ({ children }) => <ul style={{ margin: '0.5em 0', paddingLeft: '1.5em' }}>{children}</ul>,
                            ol: ({ children }) => <ol style={{ margin: '0.5em 0', paddingLeft: '1.5em' }}>{children}</ol>,
                            li: ({ children }) => <li style={{ margin: '0.2em 0' }}>{children}</li>,
                            code: ({ inline, children }) => inline ? 
                              <code style={{ 
                                backgroundColor: 'rgba(0,0,0,0.05)', 
                                padding: '2px 4px', 
                                borderRadius: '3px',
                                fontSize: '0.9em',
                                fontFamily: 'Monaco, Consolas, "Courier New", monospace'
                              }}>{children}</code> : 
                              <code style={{ fontSize: '0.9em' }}>{children}</code>,
                            pre: ({ children }) => (
                              <pre style={{ 
                                backgroundColor: 'rgba(0,0,0,0.05)', 
                                padding: '12px', 
                                borderRadius: '6px',
                                margin: '0.5em 0',
                                overflow: 'auto',
                                fontSize: '0.9em',
                                fontFamily: 'Monaco, Consolas, "Courier New", monospace'
                              }}>
                                {children}
                              </pre>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote style={{
                                borderLeft: '4px solid #1890ff',
                                paddingLeft: '12px',
                                margin: '0.5em 0',
                                fontStyle: 'italic',
                                opacity: 0.8
                              }}>
                                {children}
                              </blockquote>
                            ),
                            strong: ({ children }) => <strong style={{ fontWeight: 'bold' }}>{children}</strong>,
                            em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
                            a: ({ href, children }) => (
                              <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff', textDecoration: 'underline' }}>
                                {children}
                              </a>
                            )
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
                    )}
                  </div>
                  <div 
                    style={{ 
                      fontSize: '12px',
                      color: '#999',
                      marginTop: '4px',
                      textAlign: message.role === 'user' ? 'right' : 'left'
                    }}
                  >
                    {message.role === 'user' ? '用户' : 'AI助手'}
                  </div>
                </div>
                {message.role === 'user' && (
                  <Avatar 
                    icon={<FaUser />} 
                    style={{ 
                      backgroundColor: '#52c41a',
                      marginLeft: '8px',
                      flexShrink: 0
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* 输入框区域 - 固定在底部 */}
          <div 
            className="chat-input-area"
            style={{ 
              padding: '16px', 
              borderTop: '1px solid #f0f0f0',
              flexShrink: 0,
              backgroundColor: '#fff'
            }}>
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <TextArea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="与AI助手对话，获取写作建议..."
                rows={3}
                disabled={isLoading}
                style={{ 
                  resize: 'none',
                  flex: 1,
                  minHeight: '76px'
                }}
              />
              <Button 
                type="primary"
                onClick={handleSend}
                disabled={isLoading || input.trim() === ''}
                loading={isLoading}
                style={{ 
                  height: '76px',
                  width: '80px',
                  alignSelf: 'flex-end'
                }}
              >
                发送
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </Sider>
  );

  const contentArea = (
    <Content style={{ padding: '0 8px' }}>
      <Card 
        title="内容编辑器" 
        style={{ height: '100%', borderRadius: '8px' }}
        bodyStyle={{ padding: 0, height: 'calc(100% - 57px)' }}
      >
        {readOnly && (
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0, 0, 0, 0.5)', 
            color: 'white', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 10,
            borderRadius: '8px'
          }}>
            编辑区已锁定
          </div>
        )}
        <TextArea
          value={content}
          onChange={handleContentChange}
          placeholder="在这里创作你的小说内容..."
          readOnly={readOnly}
          style={{ 
            height: '100%', 
            border: 'none', 
            resize: 'none',
            borderRadius: '0 0 8px 8px'
          }}
        />
      </Card>
    </Content>
  );

  return (
    <div className="ai-writing-interface" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, maxHeight: 'calc(100vh - 200px)' }}>
      <Layout style={{ flex: 1, background: 'transparent', margin: '8px', minHeight: 0 }}>
        {layoutMode === 'left' ? chatSider : contentArea}
        <Divider type="vertical" style={{ margin: '0 4px' }} />
        {layoutMode === 'left' ? contentArea : chatSider}
      </Layout>
    </div>
  );
};

export default WritingEditor;