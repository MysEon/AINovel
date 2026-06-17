import React, { useCallback, useState, useEffect } from 'react';
import { FaBook } from 'react-icons/fa';
import { useNotification } from '../NotificationManager';
import { Layout, Divider, Spin } from 'antd';
import { analyzeChapterKnowledge, getChapterAnalysisStatus } from '../../services/knowledgeService';
import useWritingPersistentState from '../../hooks/useWritingPersistentState';
import { useAIModelConfig } from '../../hooks/useAIModelConfig';
import useChapters from '../../hooks/useChapters';
import useModelConfigs from '../../hooks/useModelConfigs';
import usePromptTemplates from '../../hooks/usePromptTemplates';
import useAIWriting from '../../hooks/useAIWriting';
import useFirstCharacterGuard from '../../hooks/useFirstCharacterGuard';
import BatchChapterPublishDialog from '../BatchChapterPublishDialog';
import FirstCharacterOnboardingModal from '../worldbuilding/FirstCharacterOnboardingModal';
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

  const [knowledgeAnalysisState, setKnowledgeAnalysisState] = useState({
    status: 'idle',
    message: '',
    refreshKey: 0,
  });

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
  const {
    needsOnboarding,
    loading: firstCharacterLoading,
    refresh: refreshFirstCharacterGuard,
  } = useFirstCharacterGuard(projectId);

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

  const runKnowledgeAnalysis = useCallback(async (
    chapterOverride = currentChapter,
    force = false,
    options = {},
  ) => {
    const chapter = chapterOverride || currentChapter;
    if (!projectId || !chapter?.id) return null;

    if (!selectedModelConfig?.id) {
      if (options.notifyOnMissingConfig !== false) {
        addNotification({
          message: '请选择一个可用于知识库更新的模型配置',
          type: 'warning',
          duration: 3000,
        });
      }
      return null;
    }

    setKnowledgeAnalysisState((previous) => ({
      ...previous,
      status: 'running',
      message: '正在分析本章知识变更',
    }));

    try {
      const result = await analyzeChapterKnowledge(projectId, chapter.id, selectedModelConfig.id, force);
      const proposalCount = result?.proposal_count ?? 0;
      const message = result?.message || (proposalCount > 0 ? `生成 ${proposalCount} 个知识变更提案` : '未发现待写入知识变更');
      setKnowledgeAnalysisState((previous) => ({
        status: 'success',
        message,
        refreshKey: previous.refreshKey + 1,
      }));
      if (options.notify !== false) {
        addNotification({
          message,
          type: proposalCount > 0 ? 'success' : 'info',
          duration: 3000,
        });
      }
      return result;
    } catch (error) {
      setKnowledgeAnalysisState((previous) => ({
        ...previous,
        status: 'error',
        message: error.message || '章节知识分析失败',
      }));
      if (options.notify !== false && options.notifyErrors !== false) {
        addNotification({
          message: `章节知识分析失败: ${error.message}`,
          type: 'error',
          duration: 4000,
        });
      }
      return null;
    }
  }, [addNotification, currentChapter, projectId, selectedModelConfig?.id]);

  // 草稿保存不再触发知识分析（PR2：仅发布触发，且由后端异步执行）
  const handleSaveWithKnowledgeAnalysis = useCallback(async () => saveContent(), [saveContent]);

  // 轮询章节知识分析后台任务状态，直到终态或超时
  const pollChapterAnalysis = useCallback(async (chapterId) => {
    if (!projectId || !chapterId) return;
    const TERMINAL = new Set(['succeeded', 'failed', 'cancelled', 'interrupted']);
    const MAX_POLLS = 60; // 约 5 分钟上限
    const INTERVAL = 5000;
    setKnowledgeAnalysisState((prev) => ({ ...prev, status: 'running', message: '正在分析本章知识变更' }));
    for (let i = 0; i < MAX_POLLS; i++) {
      try {
        await new Promise((r) => setTimeout(r, INTERVAL));
        const result = await getChapterAnalysisStatus(projectId, chapterId);
        const status = result?.status;
        if (status && TERMINAL.has(status)) {
          if (status === 'succeeded') {
            setKnowledgeAnalysisState((prev) => ({
              status: 'success',
              message: '知识变更分析完成',
              refreshKey: prev.refreshKey + 1,
            }));
            addNotification({ message: '知识变更分析完成，请审阅提案', type: 'success', duration: 3000 });
          } else {
            const reason = result?.error_message || '分析未成功完成';
            setKnowledgeAnalysisState((prev) => ({ ...prev, status: 'error', message: reason }));
            addNotification({ message: `知识变更分析: ${reason}`, type: 'warning', duration: 4000 });
          }
          return;
        }
      } catch (error) {
        setKnowledgeAnalysisState((prev) => ({ ...prev, status: 'error', message: error.message || '查询分析状态失败' }));
        return;
      }
    }
    setKnowledgeAnalysisState((prev) => ({ ...prev, status: 'error', message: '分析超时，请稍后在知识总览查看' }));
  }, [addNotification, projectId]);

  // 发布后由后端异步触发分析，前端改为轮询 analysis-status，不再同步阻塞
  const handlePublishWithKnowledgeAnalysis = useCallback(async () => {
    const updatedChapter = await publishChapterContent();
    if (updatedChapter?.id) {
      pollChapterAnalysis(updatedChapter.id);
    }
    return updatedChapter;
  }, [pollChapterAnalysis, publishChapterContent]);

  // Ctrl+S 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSaveWithKnowledgeAnalysis();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSaveWithKnowledgeAnalysis]);

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
    const trigger = event.currentTarget;
    const rect = trigger.getBoundingClientRect();
    setPublishButtonPosition({
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
      width: rect.width,
      height: rect.height
    });
    trigger.closest('details')?.removeAttribute('open');
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
                  projectId={projectId}
                  knowledgeAnalysisState={knowledgeAnalysisState}
                  knowledgeRefreshKey={knowledgeAnalysisState.refreshKey}
                  onAnalyzeChapterKnowledge={runKnowledgeAnalysis}
                  addNotification={addNotification}
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
                  editorProposal={aiWriting.editorProposal}
                  onApplyProposal={aiWriting.handleApplyEditorProposal}
                  onDismissProposal={aiWriting.handleDismissEditorProposal}
                  onCopyProposal={aiWriting.handleCopyEditorProposal}
                  onSelectionAction={aiWriting.handleSelectionAction}
                  selectionActionLoading={aiWriting.selectionActionLoading}
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
                  editorProposal={aiWriting.editorProposal}
                  onApplyProposal={aiWriting.handleApplyEditorProposal}
                  onDismissProposal={aiWriting.handleDismissEditorProposal}
                  onCopyProposal={aiWriting.handleCopyEditorProposal}
                  onSelectionAction={aiWriting.handleSelectionAction}
                  selectionActionLoading={aiWriting.selectionActionLoading}
                />
              ) : (
                <AIChatPanel
                  {...aiWriting}
                  projectId={projectId}
                  knowledgeAnalysisState={knowledgeAnalysisState}
                  knowledgeRefreshKey={knowledgeAnalysisState.refreshKey}
                  onAnalyzeChapterKnowledge={runKnowledgeAnalysis}
                  addNotification={addNotification}
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
            onPublish={handlePublishWithKnowledgeAnalysis}
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
            onSave={handleSaveWithKnowledgeAnalysis}
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
      <FirstCharacterOnboardingModal
        open={needsOnboarding && !firstCharacterLoading}
        projectId={projectId}
        onCreated={refreshFirstCharacterGuard}
      />
    </div>
  );
};

export default WritingEditor;
