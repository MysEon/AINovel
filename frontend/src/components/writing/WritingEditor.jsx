import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FaRobot, FaFont, FaSave, FaUpload, FaBook, FaPlus, FaLockOpen, FaLayerGroup, FaSpinner, FaMagic, FaLightbulb, FaUsers, FaExchangeAlt, FaUser, FaCog, FaFileAlt, FaBold, FaItalic, FaPaperPlane } from 'react-icons/fa';
import { useNotification } from '../NotificationManager';
import { getChapters, updateChapter, publishChapter, createChapter, getChapter, batchUpdateChapterStatus, batchPublishChapters } from '../../services/chapterService';
import { aiService, getAvailableModelConfigs } from '../../services/aiService';
import promptService from '../../services/promptService';
import BatchChapterPublishDialog from '../BatchChapterPublishDialog';
import { Layout, Button, Space, Select, Tag, Tooltip, Spin, Input, Card, Row, Col, Divider, Avatar, Dropdown, Menu } from 'antd';
// 使用官方Streamdown组件 - 修正导入方式
import { Streamdown } from 'streamdown';
import './WritingEditorSimple.css';
import useWritingPersistentState from '../../hooks/useWritingPersistentState';
import { useAIModelConfig } from '../../hooks/useAIModelConfig';

const { Sider, Content } = Layout;
const { TextArea } = Input;
const { Option } = Select;

const COLLAB_AGENT_FLOW = [
  { id: 'planner', name: '剧情规划', status: '规划剧情', tone: 'indigo' },
  { id: 'consistency', name: '设定校对', status: '检查设定', tone: 'slate' },
  { id: 'prose', name: '文风润色', status: '生成文本', tone: 'rose' }
];

const AgentStatusBadge = ({ name, status, active = false, tone = 'slate' }) => {
  const badgeToneClass = `tone-${tone}`;
  return (
    <div className={`agent-status-badge ${badgeToneClass} ${active ? 'active' : ''}`} title={`${name} · ${status}`}>
      <span className="agent-status-dot" aria-hidden="true" />
      <span className="agent-status-name">{name}</span>
      <span className="agent-status-sep">·</span>
      <span className="agent-status-text">{status}</span>
    </div>
  );
};

const EditorCanvas = ({
  content,
  onContentChange,
  readOnly,
  isGenerating = false,
  agentStatuses = [],
  selectedModelName,
  showCompletionActions = false,
  onAccept,
  onRewrite
}) => {
  return (
    <div className={`editor-canvas-shell ${isGenerating ? 'is-generating' : ''}`}>
      <div className="editor-canvas-toolbar">
        <div className="editor-canvas-tools" role="toolbar" aria-label="编辑工具">
          <button type="button" className="canvas-tool-btn" title="加粗（视觉占位）">
            <FaBold />
          </button>
          <button type="button" className="canvas-tool-btn" title="斜体（视觉占位）">
            <FaItalic />
          </button>
          <button type="button" className="canvas-tool-btn ai" title="AI 助手">
            <FaMagic />
            <span>AI 助手</span>
          </button>
        </div>
        <div className="editor-canvas-toolbar-meta">
          {selectedModelName && (
            <span className="editor-meta-pill">
              <FaRobot />
              <span>{selectedModelName}</span>
            </span>
          )}
          {isGenerating && (
            <span className="editor-meta-pill generating">
              <span className="mini-spinner" aria-hidden="true" />
              <span>AI 正在构思中...</span>
            </span>
          )}
        </div>
      </div>

      {agentStatuses.length > 0 && (
        <div className="editor-agent-strip" aria-live="polite">
          {agentStatuses.map((agent) => (
            <AgentStatusBadge
              key={agent.id}
              name={agent.name}
              status={agent.status}
              active={agent.active}
              tone={agent.tone}
            />
          ))}
        </div>
      )}

      <div className="editor-paper">
        {readOnly && <div className="editor-lock-overlay modern">编辑区已锁定</div>}
        <div className="editor-paper-inner">
          <TextArea
            value={content}
            onChange={onContentChange}
            placeholder="在这里创作你的小说内容..."
            readOnly={readOnly}
            className="editor-canvas-textarea"
            style={{
              height: '100%',
              border: 'none',
              resize: 'none',
              boxShadow: 'none',
              background: 'transparent'
            }}
          />
          {isGenerating && (
            <div className="editor-streaming-hint" aria-hidden="true">
              <span className="editor-streaming-dot" />
              <span className="editor-streaming-caret" />
            </div>
          )}
        </div>
      </div>

      {showCompletionActions && (
        <div className="editor-completion-bar">
          <div className="completion-copy">AI 生成完成，可预览后选择下一步</div>
          <div className="completion-actions">
            <button type="button" className="completion-btn ghost" onClick={onRewrite}>
              重写
            </button>
            <button type="button" className="completion-btn primary" onClick={onAccept}>
              采纳
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

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
  const [promptTemplates, setPromptTemplates] = useState([]);
  const [selectedPromptTemplate, setSelectedPromptTemplate] = useState(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const { addNotification, showConfirmDialog } = useNotification();

  // 使用全局AI模型配置持久化
  const { selectedModelConfigId: globalSelectedConfigId, setSelectedModelConfigId: setGlobalSelectedConfigId, isLoaded: configLoaded } = useAIModelConfig();

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
      if (configLoaded) {
        fetchModelConfigs();
        fetchPromptTemplates(); // 获取提示词模板
      }
    }
  }, [projectId, configLoaded]);

  // 处理模型配置选择
  const handleModelConfigChange = (configId) => {
    const config = modelConfigs.find(c => c.id === configId);
    if (config) {
      setSelectedModelConfig(config);
      aiService.setSelectedModelConfigId(configId);
      
      // 使用全局持久化
      setGlobalSelectedConfigId(configId);
      
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
      const configs = await getAvailableModelConfigs();
      setModelConfigs(configs);
      
      // 如果有配置，优先使用全局持久化的配置
      if (configs.length > 0 && configLoaded) {
        let configToSelect = null;
        
        if (globalSelectedConfigId) {
          configToSelect = configs.find(c => c.id === globalSelectedConfigId);
        }
        
        if (!configToSelect) {
          configToSelect = configs[0];
        }
        
        if (configToSelect) {
          setSelectedModelConfig(configToSelect);
          aiService.setSelectedModelConfigId(configToSelect.id);
          
          // 如果全局没有保存这个配置，则保存它
          if (globalSelectedConfigId !== configToSelect.id) {
            setGlobalSelectedConfigId(configToSelect.id);
          }
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

  // 获取提示词模板
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

  const fetchChapters = async () => {
    try {
      const chaptersData = await getChapters(projectId);
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

  const contentCharCount = (content || '').replace(/\s/g, '').length;
  const contentLineCount = content ? content.split('\n').length : 0;
  const hasCurrentChapter = Boolean(currentChapter);
  const isCurrentPublished = currentChapter?.status === 'published';
  const canPublishCurrentChapter = hasCurrentChapter && !isCurrentPublished && !isPublishing;

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
            handleModelConfigChange={handleModelConfigChange}
            aiChatState={aiChatState}
            setAiChatState={setAiChatState}
            selectedPromptTemplate={selectedPromptTemplate}
            setSelectedPromptTemplate={setSelectedPromptTemplate}
            promptTemplates={promptTemplates}
            addNotification={addNotification}
            isLoadingTemplates={isLoadingTemplates}
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
          <div className="footer-panel footer-panel-chapter">
            <div className="footer-panel-head">
              <div className="footer-panel-title">
                <FaBook />
                <span>章节导航</span>
              </div>
              <div className="footer-panel-meta">
                {currentChapter && (
                  <span className="footer-chip">
                    第 {currentChapter.chapter_number} 章
                  </span>
                )}
                {currentChapter && (
                  <span className={`chapter-status ${currentChapter.status}`}>
                    {currentChapter.status === 'published' ? '已发布' : '草稿'}
                  </span>
                )}
                {isEditorLocked && (
                  <span className="footer-chip warning">编辑锁定</span>
                )}
              </div>
            </div>

            <div className="chapter-selector">
              <label>当前章节</label>
              <select value={currentChapter?.id || ''} onChange={handleChapterChange}>
                {chapters.map(chapter => (
                  <option key={chapter.id} value={chapter.id}>
                    第{chapter.chapter_number}章 {chapter.title} ({chapter.status === 'published' ? '已发布' : '草稿'})
                  </option>
                ))}
              </select>
              {isEditorLocked && (
                <button
                  className="action-btn unlock-btn footer-icon-action"
                  onClick={handleUnlockClick}
                  title="解锁章节并回退后续发布状态"
                >
                  <FaLockOpen />
                </button>
              )}
            </div>

            {currentChapter && (
              <div className="footer-panel-subtext">
                {isCurrentPublished
                  ? '当前章节已发布，编辑前需先解锁。'
                  : '当前章节为草稿，可继续编辑并发布。'}
              </div>
            )}
          </div>

          <div className="footer-panel footer-panel-actions">
            <div className="footer-panel-head compact">
              <div className="footer-panel-title">
                <FaUpload />
                <span>发布与章节</span>
              </div>
            </div>

            <div className="footer-action-row">
              <button 
                className={`publish-button footer-cta ${currentChapter?.status === 'published' ? 'published' : ''}`}
                onClick={publishChapterContent}
                disabled={isPublishing || !currentChapter || currentChapter.status === 'published'}
                title={currentChapter?.status === 'published' ? "章节已发布" : "发布章节"}
              >
                <FaUpload />
                <span>
                  {currentChapter?.status === 'published' ? '已发布' : (isPublishing ? '发布中...' : '发布章节')}
                </span>
              </button>

              <button 
                className="batch-publish-button footer-secondary-btn"
                onClick={handleBatchPublishClick}
                disabled={!currentChapter}
                title="批量发布多个章节"
              >
                <FaLayerGroup />
                <span>批量发布</span>
              </button>

              <button 
                className="new-chapter-button footer-secondary-btn"
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

            <div className="footer-panel-subtext">
              {hasCurrentChapter
                ? (canPublishCurrentChapter ? '发布会将当前章节状态变更为“已发布”。' : '可先保存草稿，再按需发布。')
                : '请先创建或选择章节。'}
            </div>
          </div>
        </div>
        <div className="footer-right">
          <div className="footer-panel footer-panel-session">
            <div className="footer-panel-head">
              <div className="footer-panel-title">
                <FaSave />
                <span>写作控制</span>
              </div>
              <div className="footer-metrics" aria-label="当前内容统计">
                <div className="footer-metric">
                  <strong>{contentCharCount}</strong>
                  <span>字</span>
                </div>
                <div className="footer-metric">
                  <strong>{contentLineCount}</strong>
                  <span>行</span>
                </div>
              </div>
            </div>

            <div className="footer-action-row">
              <button 
                className="save-button footer-save-btn"
                onClick={saveContent}
                disabled={isSaving}
                title="保存内容 (Ctrl+S)"
              >
                <FaSave />
                <span>{isSaving ? '保存中...' : '保存草稿'}</span>
              </button>
              <button 
                className={`ai-toggle-button footer-ai-toggle ${aiAssisted ? 'active' : ''}`}
                onClick={toggleAiAssisted}
                aria-label={aiAssisted ? "关闭AI辅助" : "开启AI辅助"}
              >
                {aiAssisted ? <FaRobot /> : <FaFont />}
                <span>{aiAssisted ? "AI辅助中" : "AI辅助"}</span>
              </button>
            </div>

            {aiAssisted && (
              <div className="footer-ai-inline">
                <div className="footer-ai-inline-head">
                  <FaRobot />
                  <span>AI写作控制</span>
                </div>
                <div className="footer-ai-inline-body">
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
                      className="layout-toggle-button footer-layout-toggle"
                    >
                      布局
                    </Button>
                  </Tooltip>
                </div>
              </div>
            )}

            <div className="footer-panel-subtext">
              先保存草稿再发布更稳妥，支持快捷键 <kbd>Ctrl</kbd> + <kbd>S</kbd>。
            </div>
          </div>
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

const AiWritingInterface = ({ content, onContentChange, readOnly, projectId, currentChapter, layoutMode, modelConfigs = [], selectedModelConfig = null, handleModelConfigChange, aiChatState, setAiChatState, selectedPromptTemplate, setSelectedPromptTemplate, promptTemplates, addNotification, isLoadingTemplates }) => {
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
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);
  const [showGenerationActions, setShowGenerationActions] = useState(false);
  const [currentAiActionLabel, setCurrentAiActionLabel] = useState('对话建议');
  const messagesContainerRef = useRef(null);
  const chatInputRef = useRef(null);
  const loadingStateRef = useRef(false);
  
  // 用于防止循环更新的标记
  const isUpdatingFromState = useRef(false);
  const isUpdatingToState = useRef(false);

  // 当章节变化或aiChatState变化时，更新聊天记录
  useEffect(() => {
    if (currentChapter?.id && aiChatState?.messages && !isUpdatingFromState.current) {
      isUpdatingFromState.current = true;
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
        if (setAiChatState && !isUpdatingToState.current) {
          isUpdatingToState.current = true;
          setAiChatState({ messages: defaultMessages });
          setTimeout(() => { isUpdatingToState.current = false; }, 0);
        }
      }
      setTimeout(() => { isUpdatingFromState.current = false; }, 0);
    }
  }, [currentChapter?.id, aiChatState, setAiChatState]);

  // 消息变化时持久化到存储（只在非初始化更新时）
  useEffect(() => {
    if (currentChapter?.id && messages.length > 1 && setAiChatState && !isUpdatingFromState.current && !isUpdatingToState.current) {
      isUpdatingToState.current = true;
      setAiChatState({ messages });
      setTimeout(() => { isUpdatingToState.current = false; }, 0);
    }
  }, [messages, currentChapter?.id, setAiChatState]);

  // 生成时轮转 Agent 激活态（纯 UI 模拟）
  useEffect(() => {
    if (!isLoading) return;

    const timer = setInterval(() => {
      setActiveAgentIndex(prev => (prev + 1) % COLLAB_AGENT_FLOW.length);
    }, 1400);

    return () => clearInterval(timer);
  }, [isLoading]);

  // 控制生成完成后的“采纳/重写”操作栏显示
  useEffect(() => {
    if (loadingStateRef.current && !isLoading) {
      const hasAssistantResponse = [...messages].reverse().some(
        (msg) => msg.role === 'assistant' && !msg.isThinking && msg.content
      );
      if (hasAssistantResponse) {
        setShowGenerationActions(true);
      }
    }

    if (!loadingStateRef.current && isLoading) {
      setShowGenerationActions(false);
    }

    loadingStateRef.current = isLoading;
  }, [isLoading, messages]);

  // 开启新对话功能
  const handleNewChat = () => {
    const newChatMessages = [
      { id: 1, role: 'assistant', content: '你好！我是你的AI写作助手。我可以帮助你进行创意构思、内容优化、情节建议等。有什么需要帮助的吗？' }
    ];
    setMessages(newChatMessages);
    // 清空输入框
    setInput('');
    // 重置加载状态
    setIsLoading(false);
    setShowGenerationActions(false);
    setCurrentAiActionLabel('对话建议');
    // 持久化新的聊天记录
    if (setAiChatState && !isUpdatingToState.current) {
      isUpdatingToState.current = true;
      setAiChatState({ messages: newChatMessages });
      setTimeout(() => { isUpdatingToState.current = false; }, 0);
    }
  };

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

    // 保存用户输入的内容
    const userInputContent = input;
    const userMessage = { id: messages.length + 1, role: 'user', content: userInputContent };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setCurrentAiActionLabel('续写建议');
    setShowGenerationActions(false);
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
        // 使用ref来跟踪当前消息内容，避免状态竞争
        const currentContentRef = { current: '' };
        
        await aiService.chatWithAIStream(
          projectId,
          userInputContent,  // 传入用户当前输入的内容
          newMessages,  // 传入包含用户新消息的聊天历史
          (chunk) => {
            // 只过滤null和undefined，保留所有有效内容
            if (chunk !== null && chunk !== undefined) {
              // 直接拼接文本，不做任何额外处理，完全依赖Streamdown
              if (isFirstChunk) {
                currentContentRef.current = chunk;
              } else {
                currentContentRef.current += chunk;
              }
              
              
              setMessages(prev => prev.map(msg => 
                msg.id === aiResponseId 
                  ? { 
                      ...msg, 
                      content: currentContentRef.current, // Streamdown会自动处理markdown格式
                      isThinking: false  // 收到内容后取消思考状态
                    }
                  : msg
              ));
              if (isFirstChunk) isFirstChunk = false;
            }
          },
          () => {
            // 流式完成时，确保最终状态同步
            setTimeout(() => {
              setIsLoading(false);
            }, 100);
          },
          selectedPromptTemplate?.id  // 传入选中的模板 ID
        );
      } else {
        // 使用普通输出
        const response = await aiService.chatWithAI(projectId, userInputContent, newMessages, selectedPromptTemplate?.id);  // 传入用户输入内容和包含新消息的历史消息，以及模板 ID
        // 更新思考中的消息为实际回复
        setMessages(prev => prev.map(msg => 
          msg.id === aiResponseId 
            ? { 
                ...msg, 
                content: response.content || response.response || '抱歉，我暂时无法回复。', // 直接使用原始内容
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
              content: `抱歉，AI服务暂时不可用: ${error.message}`, // 直接使用原始内容
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

    const actionLabelMap = {
      outline: '章节大纲',
      suggestions: '剧情建议',
      optimize: '文本润色',
      ideas: '创意发散'
    };

    setCurrentAiActionLabel(actionLabelMap[action] || 'AI处理');
    setShowGenerationActions(false);
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
              content: response.content || response.suggestions || response.optimized_content || '操作完成', // 直接使用原始内容
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
              content: `${action} 操作失败: ${error.message}`, // 直接使用原始内容
              isThinking: false
            }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const lastMessage = messages[messages.length - 1];
  const streamingMessageId = (isLoading && lastMessage?.role === 'assistant' && !lastMessage?.isThinking)
    ? lastMessage.id
    : null;

  const agentStatuses = COLLAB_AGENT_FLOW.map((agent, index) => {
    if (!isLoading) {
      return {
        ...agent,
        status: index === 0 ? '待命' : '空闲',
        active: false
      };
    }

    const statusByIndex = ['正在执行', '准备中', '等待中'];
    const distance = (index - activeAgentIndex + COLLAB_AGENT_FLOW.length) % COLLAB_AGENT_FLOW.length;

    return {
      ...agent,
      status: index === activeAgentIndex ? `${currentAiActionLabel}` : statusByIndex[distance] || '等待中',
      active: index === activeAgentIndex
    };
  });

  const handleAcceptGeneratedResult = () => {
    setShowGenerationActions(false);
  };

  const handleRewriteGeneratedResult = () => {
    setShowGenerationActions(false);
    setInput((prev) => prev || '请基于刚才的结果重写一版，保持人物设定与剧情逻辑一致。');
    setTimeout(() => {
      chatInputRef.current?.focus?.();
    }, 0);
  };

  const chatSider = (
    <Sider
      width="45%"
      className={`ai-chat-sider-shell ${isLoading ? 'is-active' : ''}`}
      style={{ background: 'transparent', padding: '0 8px', height: '100%', overflow: 'hidden' }}
    >
      <div className={`ai-chat-drawer ${isLoading ? 'is-open' : ''}`} style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* AI快捷操作按钮 - 固定在顶部 */}
        <Card
          className="ai-assistant-toolbar-card"
          title={
            <div className="ai-assistant-toolbar-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="ai-assistant-title-group">
                <span className="ai-assistant-title-text">AI写作助手</span>
                {isLoading && <span className="ai-assistant-live-pill">协作中</span>}
              </div>
              <div className="ai-assistant-toolbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Button
                  type="text"
                  size="small"
                  icon={<FaPlus />}
                  onClick={handleNewChat}
                  title="开启新对话"
                  disabled={isLoading}
                  style={{ color: '#1890ff' }}
                >
                  新对话
                </Button>
                {selectedModelConfig && (
                  <Tag color="blue" style={{ marginRight: 8 }}>
                    {selectedModelConfig.name}
                  </Tag>
                )}
                {selectedPromptTemplate && (
                  <Tag color="green" style={{ marginRight: 8 }}>
                    {selectedPromptTemplate.name}
                  </Tag>
                )}
                <Dropdown
                  overlay={
                    <Menu onClick={(e) => {
                      const templateId = parseInt(e.key);
                      const template = promptTemplates.find(t => t.id === templateId);
                      if (template) {
                        setSelectedPromptTemplate(template);
                        addNotification({
                          message: `已切换到模板：${template.name}`,
                          type: 'success',
                          duration: 2000
                        });
                      }
                    }}>
                      {promptTemplates.map(template => (
                        <Menu.Item key={template.id}>
                          <div>
                            <div>{template.name}</div>
                            <div style={{ fontSize: '12px', color: '#999' }}>
                              {template.description}
                            </div>
                          </div>
                        </Menu.Item>
                      ))}
                      {promptTemplates.length === 0 && (
                        <Menu.Item disabled>
                          <span style={{ color: '#999' }}>暂无可用模板</span>
                        </Menu.Item>
                      )}
                    </Menu>
                  }
                  trigger={['click']}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<FaFileAlt />}
                    title="选择提示词模板"
                    loading={isLoadingTemplates}
                    style={{ color: selectedPromptTemplate ? '#52c41a' : '#8c8c8c' }}
                  />
                </Dropdown>
                <Dropdown
                  overlay={
                    <Menu onClick={(e) => handleModelConfigChange(parseInt(e.key))}>
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
          <div className="ai-toolbar-status-strip" aria-live="polite">
            {agentStatuses.map((agent) => (
              <AgentStatusBadge
                key={`panel-${agent.id}`}
                name={agent.name}
                status={agent.status}
                active={agent.active}
                tone={agent.tone}
              />
            ))}
          </div>
          <Space wrap>
            <Button
              className="ai-quick-action-btn"
              icon={<FaMagic />}
              onClick={() => handleAIAction('outline')}
              disabled={isLoading || modelConfigs.length === 0}
              size="small"
            >
              大纲
            </Button>
            <Button
              className="ai-quick-action-btn"
              icon={<FaLightbulb />}
              onClick={() => handleAIAction('suggestions')}
              disabled={isLoading || modelConfigs.length === 0}
              size="small"
            >
              建议
            </Button>
            <Button
              className="ai-quick-action-btn"
              icon={<FaSpinner />}
              onClick={() => handleAIAction('optimize')}
              disabled={isLoading || modelConfigs.length === 0}
              size="small"
            >
              优化
            </Button>
            <Button
              className="ai-quick-action-btn"
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
          className="ai-chat-card"
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
            {messages.map((message) => {
              const isStreamingMessage = message.id === streamingMessageId;
              const rowRole = message.role === 'user' ? 'user' : 'assistant';

              return (
                <div
                  key={message.id}
                  className={`chat-message-row ${rowRole} ${message.isThinking ? 'thinking' : ''} ${isStreamingMessage ? 'streaming' : ''}`}
                >
                  {message.role === 'assistant' && (
                    <Avatar
                      className="chat-message-avatar assistant"
                      icon={<FaRobot />}
                      style={{
                        backgroundColor: '#4f46e5',
                        marginRight: '8px',
                        flexShrink: 0
                      }}
                    />
                  )}
                  <div className={`chat-message-stack ${rowRole}`}>
                    <div className={`chat-message-bubble ${rowRole}`}>
                      {message.role === 'assistant' && message.isThinking ? (
                        <div className="thinking-inline">
                          <Spin size="small" />
                          <span>AI正在思考中...</span>
                        </div>
                      ) : message.role === 'assistant' ? (
                        <div className="ai-chat-markdown">
                          <Streamdown
                            key={message.id}
                            parseIncompleteMarkdown={true}
                            className="ai-chat-content streamdown-chat"
                            shikiTheme="github-light"
                          >
                            {(() => {
                              let content = message.content || '';

                              // 修复流式传输导致的不完整代码块标记
                              const codeBlockCount = (content.match(/```/g) || []).length;

                              // 如果代码块标记是奇数个，自动补全结束标记
                              if (codeBlockCount % 2 === 1) {
                                content = content + '\n```';
                              }

                              return content;
                            })()}
                          </Streamdown>
                          {isStreamingMessage && <span className="stream-caret" aria-hidden="true" />}
                        </div>
                      ) : (
                        <span className="user-message-text" style={{ whiteSpace: 'pre-wrap' }}>
                          {message.content}
                        </span>
                      )}
                    </div>
                    <div className={`chat-message-meta ${rowRole}`}>
                      {message.role === 'user' ? '用户' : 'AI助手'}
                    </div>
                  </div>
                  {message.role === 'user' && (
                    <Avatar
                      className="chat-message-avatar user"
                      icon={<FaUser />}
                      style={{
                        backgroundColor: '#0ea5e9',
                        marginLeft: '8px',
                        flexShrink: 0
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* 输入框区域 - 固定在底部 */}
          <div className="chat-input-area" style={{ flexShrink: 0 }}>
            <div className={`chat-input-wrapper${input.trim() ? ' has-content' : ''}${isLoading ? ' is-loading' : ''}`}>
              <TextArea
                ref={chatInputRef}
                className="chat-input-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="与AI助手对话，获取写作建议..."
                autoSize={{ minRows: 1, maxRows: 5 }}
                disabled={isLoading}
              />
              <button
                className={`chat-send-btn${input.trim() && !isLoading ? ' active' : ''}`}
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                title="发送 (Enter)"
              >
                {isLoading ? <FaSpinner className="send-spinner" /> : <FaPaperPlane />}
              </button>
            </div>
            <div className="chat-input-hint">
              <span>Enter 发送 · Shift+Enter 换行</span>
            </div>
          </div>
        </Card>
      </div>
    </Sider>
  );

  const contentArea = (
    <Content className="editor-canvas-pane" style={{ padding: '0 8px' }}>
      <EditorCanvas
        content={content}
        onContentChange={handleContentChange}
        readOnly={readOnly}
        isGenerating={isLoading}
        agentStatuses={agentStatuses}
        selectedModelName={selectedModelConfig?.name}
        showCompletionActions={showGenerationActions}
        onAccept={handleAcceptGeneratedResult}
        onRewrite={handleRewriteGeneratedResult}
      />
    </Content>
  );

  return (
    <div className="ai-writing-interface modern-ai-layout" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, maxHeight: 'calc(100vh - 200px)' }}>
      <Layout className="ai-writing-layout-shell" style={{ flex: 1, background: 'transparent', margin: '8px', minHeight: 0 }}>
        {layoutMode === 'left' ? chatSider : contentArea}
        <Divider type="vertical" className="ai-layout-divider" style={{ margin: '0 4px' }} />
        {layoutMode === 'left' ? contentArea : chatSider}
      </Layout>
    </div>
  );
};

export default WritingEditor;
