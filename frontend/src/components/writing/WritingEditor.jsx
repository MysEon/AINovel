import React, { useState, useEffect, useCallback } from 'react';
import { FaRobot, FaFont, FaSave, FaUpload, FaBook, FaPlus, FaLockOpen } from 'react-icons/fa';
import { useNotification } from '../NotificationManager';
import ConfirmationDialog from './ConfirmationDialog';
import { getChapters, updateChapter, publishChapter, createChapter, getChapter, batchUpdateChapterStatus } from '../../services/chapterService';
import './WritingEditorSimple.css';

const WritingEditor = ({ projectId, initialChapterId, onChapterChange, onProjectsChange }) => {
  const [aiAssisted, setAiAssisted] = useState(false);
  const [aiMode, setAiMode] = useState('optimize'); // 'optimize' or 'takeover'
  const [content, setContent] = useState('');
  const [currentChapter, setCurrentChapter] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [manualChapter, setManualChapter] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isEditorLocked, setIsEditorLocked] = useState(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
  const [showNewChapterDialog, setShowNewChapterDialog] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const { addNotification } = useNotification();

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
          .sort((a, b) => b.order_index - a.order_index)[0];
        
        if (lastPublished) {
          const nextChapterIndex = lastPublished.order_index + 1;
          chapterToSet = chaptersData.find(ch => ch.order_index === nextChapterIndex) || 
            { id: null, title: `第${nextChapterIndex}章`, order_index: nextChapterIndex, status: 'draft' };
        } else if (chaptersData.length > 0) {
          // 如果没有已发布章节，选择第一个
          chapterToSet = chaptersData[0];
        } else {
          // 如果没有任何章节，创建一个默认的
          chapterToSet = { id: null, title: '第一章', order_index: 1, status: 'draft' };
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
    if (selectedId === 'manual') {
      setCurrentChapter(null);
      setContent('');
      setManualChapter('');
    } else {
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

  const handleUnlockConfirm = async () => {
    if (!currentChapter || !projectId) return;

    try {
      await batchUpdateChapterStatus({
        project_id: projectId,
        from_order_index: currentChapter.order_index,
        new_status: 'draft'
      });
      
      addNotification({
        message: '章节已解锁，您可以开始编辑了',
        type: 'success',
        duration: 3000
      });

      setShowUnlockConfirm(false);
      await fetchChapters(); // 重新获取章节以更新状态
      // 找到并设置当前章节
      const reloadedChapter = await getChapter(currentChapter.id);
      setCurrentChapter(reloadedChapter);

    } catch (error) {
      addNotification({
        message: '解锁失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
    }
  };

  // 开启新章
  const handleStartNewChapter = async () => {
    if (!newChapterTitle.trim() || !projectId) return;
    
    try {
      const nextOrderIndex = chapters.length > 0
        ? Math.max(...chapters.map(ch => ch.order_index)) + 1
        : 1;

      const newChapterData = {
        title: newChapterTitle,
        content: '',
        outline: '',
        order_index: nextOrderIndex,
        status: 'draft'
      };
      
      const newChapter = await createChapter(projectId, newChapterData);
      
      setChapters(prev => [...prev, newChapter].sort((a, b) => a.order_index - b.order_index));
      setCurrentChapter(newChapter);
      setShowNewChapterDialog(false);
      setNewChapterTitle('');
      
      addNotification({
        message: '新章节已开启',
        type: 'success',
        duration: 3000
      });

      if (onProjectsChange) {
        onProjectsChange();
      }
    } catch (error) {
      addNotification({
        message: '开启新章失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
    }
  };

  const handleManualChapterChange = (e) => {
    setManualChapter(e.target.value);
  };

  // 创建新章节
  const createNewChapter = async () => {
    if (!manualChapter.trim() || !projectId) return;
    
    try {
      const newChapterData = {
        title: manualChapter.trim(),
        content: '',
        outline: '',
        order_index: chapters.length + 1,
        status: 'draft'
        // project_id由后端从URL参数中获取，不需要在请求体中发送
      };
      
      const newChapter = await createChapter(projectId, newChapterData);
      
      // 添加到章节列表
      setChapters(prev => [...prev, newChapter]);
      
      // 设置为当前章节
      setCurrentChapter(newChapter);
      setContent('');
      setManualChapter('');
      
      addNotification({
        message: '新章节已创建',
        type: 'success',
        duration: 3000
      });

      if (onProjectsChange) {
        onProjectsChange();
      }
    } catch (error) {
      addNotification({
        message: '创建章节失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
    }
  };

  const getChapterDisplay = () => {
    if (manualChapter) {
      return manualChapter;
    }
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
        {chapters.length === 0 && !manualChapter ? (
          <div className="empty-chapters-notice">
            <h3>欢迎开始创作！</h3>
            <p>您的项目目前还没有章节。</p>
            <button className="create-chapter-button" onClick={() => setManualChapter('第一章')}>
              <FaBook /> 创建第一个章节
            </button>
            <p>点击上方按钮创建您的第一个章节，开始您的创作之旅。</p>
          </div>
        ) : aiAssisted ? (
          <AiWritingInterface content={content} onContentChange={handleContentChange} />
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
                  {chapter.title} ({chapter.status === 'published' ? '已发布' : '草稿'})
                </option>
              ))}
              <option value="manual">手动输入</option>
            </select>
            {currentChapter && (
              <span className={`chapter-status ${currentChapter.status}`}>
                {currentChapter.status === 'published' ? '已发布' : '草稿'}
              </span>
            )}
            {isEditorLocked && (
              <button className="publish-button unlock" onClick={() => setShowUnlockConfirm(true)}>
                <FaLockOpen />
                解锁
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
            className="publish-button"
            onClick={() => setShowNewChapterDialog(true)}
            title="开启一个全新的章节"
          >
            <FaPlus />
            <span>开启新章</span>
          </button>
          {manualChapter !== '' && (
            <div className="manual-chapter-input-group">
              <input
                type="text"
                value={manualChapter}
                onChange={handleManualChapterChange}
                placeholder="输入章节名称"
                className="manual-chapter-input"
              />
              <button 
                className="create-chapter-button"
                onClick={createNewChapter}
                disabled={!manualChapter.trim()}
              >
                创建章节
              </button>
            </div>
          )}
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

      {showUnlockConfirm && (
        <ConfirmationDialog
          title="确认解锁章节"
          message={`您确定要解锁章节 "${currentChapter?.title}" 吗？这将导致该章节及其之后的所有已发布章节状态变更为“草稿”，以便您可以重新编辑。`}
          onConfirm={handleUnlockConfirm}
          onCancel={() => setShowUnlockConfirm(false)}
          confirmText="确认解锁"
        />
      )}

      {showNewChapterDialog && (
        <NewChapterDialog
          value={newChapterTitle}
          onChange={(e) => setNewChapterTitle(e.target.value)}
          onConfirm={handleStartNewChapter}
          onCancel={() => setShowNewChapterDialog(false)}
        />
      )}
    </div>
  );
};

const NewChapterDialog = ({ value, onChange, onConfirm, onCancel }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>开启新章节</h2>
        <p>请输入新章节的标题：</p>
        <input
          type="text"
          value={value}
          onChange={onChange}
          placeholder="例如：第三章：新的征程"
          autoFocus
        />
        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="confirm-btn" onClick={onConfirm} disabled={!value.trim()}>
            确认
          </button>
        </div>
      </div>
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

const AiWritingInterface = ({ content, onContentChange }) => {
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
        <textarea
          className="content-textarea"
          value={content}
          onChange={handleContentChange}
          placeholder="在这里创作你的小说内容..."
        />
      </div>
    </div>
  );
};

export default WritingEditor;