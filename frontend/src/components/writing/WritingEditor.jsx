import React, { useState, useEffect, useCallback } from 'react';
import { FaRobot, FaFont, FaSave, FaUpload, FaBook, FaPlus, FaLockOpen, FaLayerGroup } from 'react-icons/fa';
import { useNotification } from '../NotificationManager';
import { getChapters, updateChapter, publishChapter, createChapter, getChapter, batchUpdateChapterStatus, batchPublishChapters } from '../../services/chapterService';
import BatchChapterPublishDialog from '../BatchChapterPublishDialog';
import './WritingEditorSimple.css';

const WritingEditor = ({ projectId, initialChapterId, onChapterChange, onProjectsChange }) => {
  const [aiAssisted, setAiAssisted] = useState(false);
  const [aiMode, setAiMode] = useState('optimize'); // 'optimize' or 'takeover'
  const [content, setContent] = useState('');
  const [currentChapter, setCurrentChapter] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isEditorLocked, setIsEditorLocked] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [showBatchPublish, setShowBatchPublish] = useState(false);
  const [publishButtonPosition, setPublishButtonPosition] = useState(null);
  const { addNotification, showConfirmDialog } = useNotification();

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

  // 获取项目章节数据
  useEffect(() => {
    if (projectId) {
      fetchChapters();
    }
  }, [projectId]);

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
          chapterToSet = chaptersData.find(ch => ch.chapter_number === nextChapterNumber) || 
            { id: null, title: `第${nextChapterNumber}章`, chapter_number: nextChapterNumber, status: 'draft' };
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
      
      // 更新当前章节状态
      setCurrentChapter(updatedChapter);
      
      // 刷新章节列表
      await fetchChapters();
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
  }, [isPublishing, content, currentChapter, addNotification, fetchChapters]);

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
    setAiAssisted(!aiAssisted);
  };

  const handleAiModeChange = (mode) => {
    setAiMode(mode);
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
    if (!title.trim() || !projectId) return;
    
    const newChapterData = {
      title: title,
      content: '',
      outline: '',
      status: 'draft'
    };
    
    const newChapter = await createChapter(projectId, newChapterData);
    
    setChapters(prev => [...prev, newChapter].sort((a, b) => a.chapter_number - b.chapter_number));
    setCurrentChapter(newChapter);
    setNewChapterTitle('');

    if (onProjectsChange) {
      onProjectsChange();
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
      right: rect.right
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
            <p>点击上方按钮创建您的第一个章节，开始您的创作之旅。</p>
          </div>
        ) : aiAssisted ? (
          <AiWritingInterface 
            content={content} 
            onContentChange={handleContentChange} 
            readOnly={isEditorLocked} 
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

const AiWritingInterface = ({ content, onContentChange, readOnly }) => {
  const [messages, setMessages] = useState([
    { id: 1, role: 'assistant', content: '你好！我是你的AI写作助手。我可以帮助你 brainstorm ideas, improve your writing, or answer questions about your story. What would you like to work on today?' }
  ]);
  const [input, setInput] = useState('');

  const handleContentChange = (e) => {
    onContentChange(e.target.value);
  };

  const handleSend = () => {
    if (input.trim() === '') return;

    // 添加用户消息
    const userMessage = { id: messages.length + 1, role: 'user', content: input };
    setMessages([...messages, userMessage]);
    
    // 模拟AI回复
    setTimeout(() => {
      const aiResponse = { 
        id: messages.length + 2, 
        role: 'assistant', 
        content: `这是一个模拟的AI回复，针对你的问题: "${input}"。在实际实现中，这里会调用AI API来生成真实的回复。`
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
    
    setInput('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="ai-writing-interface">
      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((message) => (
            <div key={message.id} className={`message ${message.role}`}>
              <div className="message-content">
                {message.content}
              </div>
            </div>
          ))}
        </div>
        <div className="chat-input-container">
          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="与AI助手对话，获取写作建议..."
            rows="3"
          />
          <button className="send-button" onClick={handleSend}>
            发送
          </button>
        </div>
      </div>
      <div className="content-editor">
        {readOnly && <div className="editor-lock-overlay">编辑区已锁定</div>}
        <textarea
          className={`content-textarea ${readOnly ? 'locked' : ''}`}
          value={content}
          onChange={handleContentChange}
          placeholder="在这里创作你的小说内容..."
          readOnly={readOnly}
        />
      </div>
    </div>
  );
};

export default WritingEditor;