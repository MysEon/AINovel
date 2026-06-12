import React, { useState, useEffect } from 'react';
import { FaBook } from 'react-icons/fa';
import { useNotification } from '../NotificationManager';
import { Layout, Divider, Spin } from 'antd';
import useWritingPersistentState from '../../hooks/useWritingPersistentState';
import { useAIModelConfig } from '../../hooks/useAIModelConfig';
import useChapters from '../../hooks/useChapters';
import useModelConfigs from '../../hooks/useModelConfigs';
import usePromptTemplates from '../../hooks/usePromptTemplates';
import useAIWriting from '../../hooks/useAIWriting';
import BatchChapterPublishDialog from '../BatchChapterPublishDialog';
import ChapterList from './ChapterList';
import ChapterActionsPanel from './ChapterActionsPanel';
import SessionPanel from './SessionPanel';
import AIChatPanel from './AIChatPanel';
import EditorPanel from './EditorPanel';
import './WritingEditorSimple.css';

const WritingEditor = ({ projectId, initialChapterId, onChapterChange, onProjectsChange }) => {
  const { addNotification, showConfirmDialog } = useNotification();
  const { selectedModelConfigId: globalSelectedConfigId, setSelectedModelConfigId: setGlobalSelectedConfigId, isLoaded: configLoaded } = useAIModelConfig();

  const {
    currentChapter,
    content,
    chapters,
    isSaving,
    isPublishing,
    isEditorLocked,
    newChapterTitle,
    setNewChapterTitle,
    fetchChapters,
    saveContent,
    publishChapterContent,
    handleContentChange,
    handleChapterChange,
    handleUnlockClick,
    handleStartNewChapter,
    handleBatchPublish
  } = useChapters({ projectId, initialChapterId, onChapterChange, addNotification, onProjectsChange, showConfirmDialog });

  const {
    modelConfigs,
    selectedModelConfig,
    fetchModelConfigs,
    handleModelConfigChange
  } = useModelConfigs({ addNotification, configLoaded, globalSelectedConfigId, setGlobalSelectedConfigId });

  const {
    promptTemplates,
    selectedPromptTemplate,
    isLoadingTemplates,
    fetchPromptTemplates,
    setSelectedPromptTemplate
  } = usePromptTemplates({ addNotification });

  const {
    writingState,
    setWritingState,
    aiChatState,
    setAiChatState,
    isRestoring,
    restorationProgress
  } = useWritingPersistentState(projectId, currentChapter?.id);

  const aiAssisted = writingState?.aiAssisted ?? false;
  const aiMode = writingState?.aiMode ?? 'optimize';
  const layoutMode = writingState?.layoutMode ?? 'left';

  // 获取项目章节数据和模型配置
  useEffect(() => {
    if (projectId) {
      fetchChapters();
      if (configLoaded) {
        fetchModelConfigs();
        fetchPromptTemplates();
      }
    }
  }, [projectId, configLoaded]);

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

  const [showBatchPublish, setShowBatchPublish] = useState(false);
  const [publishButtonPosition, setPublishButtonPosition] = useState(null);

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

  const handlePromptTemplateSelect = (templateId) => {
    const template = promptTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedPromptTemplate(template);
      addNotification({
        message: `已切换到模板：${template.name}`,
        type: 'success',
        duration: 2000
      });
    }
  };

  const aiWriting = useAIWriting({
    projectId,
    currentChapter,
    content,
    onContentChange: handleContentChange,
    modelConfigs,
    selectedModelConfig,
    handleModelConfigChange,
    aiChatState,
    setAiChatState,
    selectedPromptTemplate,
    setSelectedPromptTemplate,
    promptTemplates,
    addNotification,
    isLoadingTemplates
  });

  const contentCharCount = (content || '').replace(/\s/g, '').length;
  const contentLineCount = content ? content.split('\n').length : 0;
  const hasCurrentChapter = Boolean(currentChapter);
  const isCurrentPublished = currentChapter?.status === 'published';
  const canPublishCurrentChapter = hasCurrentChapter && !isCurrentPublished && !isPublishing;

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
              <progress
                className="restoration-progress-bar"
                value={restorationProgress}
                max="100"
                aria-label="写作状态恢复进度"
              />
            </div>
            <div className="restoration-details">
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
                onInputChange: () => {},
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
          <div className="ai-writing-interface modern-ai-layout">
            <Layout className="ai-writing-layout-shell">
              {layoutMode === 'left' ? (
                <AIChatPanel
                  {...aiWriting}
                  onModelConfigChange={handleModelConfigChange}
                  onPromptTemplateSelect={handlePromptTemplateSelect}
                />
              ) : (
                <EditorPanel
                  currentChapter={currentChapter}
                  content={content}
                  contentCharCount={contentCharCount}
                  contentLineCount={contentLineCount}
                  onContentChange={handleContentChange}
                  readOnly={isEditorLocked}
                  isAiAssisted={true}
                  isGenerating={aiWriting.isLoading}
                  agentStatuses={aiWriting.agentStatuses}
                  selectedModelName={selectedModelConfig?.name}
                  showCompletionActions={aiWriting.showGenerationActions}
                  onAccept={aiWriting.handleAcceptGeneratedResult}
                  onRewrite={aiWriting.handleRewriteGeneratedResult}
                />
              )}
              <Divider type="vertical" className="ai-layout-divider" />
              {layoutMode === 'left' ? (
                <EditorPanel
                  currentChapter={currentChapter}
                  content={content}
                  contentCharCount={contentCharCount}
                  contentLineCount={contentLineCount}
                  onContentChange={handleContentChange}
                  readOnly={isEditorLocked}
                  isAiAssisted={true}
                  isGenerating={aiWriting.isLoading}
                  agentStatuses={aiWriting.agentStatuses}
                  selectedModelName={selectedModelConfig?.name}
                  showCompletionActions={aiWriting.showGenerationActions}
                  onAccept={aiWriting.handleAcceptGeneratedResult}
                  onRewrite={aiWriting.handleRewriteGeneratedResult}
                />
              ) : (
                <AIChatPanel
                  {...aiWriting}
                  onModelConfigChange={handleModelConfigChange}
                  onPromptTemplateSelect={handlePromptTemplateSelect}
                />
              )}
            </Layout>
          </div>
        ) : (
          <EditorPanel
            currentChapter={currentChapter}
            content={content}
            contentCharCount={contentCharCount}
            contentLineCount={contentLineCount}
            onContentChange={handleContentChange}
            readOnly={isEditorLocked}
            isAiAssisted={false}
          />
        )}
      </div>
      <div className={`editor-footer ${aiAssisted ? 'is-ai-active' : ''}`}>
        <div className="footer-left">
          <ChapterList
            chapters={chapters}
            currentChapter={currentChapter}
            isEditorLocked={isEditorLocked}
            onChapterChange={handleChapterChange}
            onUnlockClick={handleUnlockClick}
          />
          <ChapterActionsPanel
            currentChapter={currentChapter}
            isPublishing={isPublishing}
            canPublishCurrentChapter={canPublishCurrentChapter}
            hasCurrentChapter={hasCurrentChapter}
            onPublish={publishChapterContent}
            onBatchPublishClick={handleBatchPublishClick}
            onNewChapterClick={() => {
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
          />
        </div>
        <div className="footer-right">
          <SessionPanel
            contentCharCount={contentCharCount}
            contentLineCount={contentLineCount}
            isSaving={isSaving}
            onSave={saveContent}
            aiAssisted={aiAssisted}
            onToggleAiAssisted={toggleAiAssisted}
            aiMode={aiMode}
            onAiModeChange={handleAiModeChange}
            layoutMode={layoutMode}
            onToggleLayout={toggleLayout}
          />
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

export default WritingEditor;
