import React, { useState, useEffect, useCallback } from 'react';
import { FaRobot, FaFont, FaSave, FaUpload, FaBook } from 'react-icons/fa';
import { useNotification } from '../NotificationManager';
import { getChapters, updateChapter, publishChapter, createChapter } from '../../services/chapterService';
import './WritingEditorSimple.css';

const WritingEditor = ({ projectId }) => {
  const [aiAssisted, setAiAssisted] = useState(false);
  const [aiMode, setAiMode] = useState('optimize'); // 'optimize' or 'takeover'
  const [content, setContent] = useState('');
  const [currentChapter, setCurrentChapter] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [manualChapter, setManualChapter] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const { addNotification } = useNotification();

  // 调试信息
  useEffect(() => {
    console.log('WritingEditor mounted with projectId:', projectId);
  }, [projectId]);

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
      
      // 默认选择最后一个已发布章节的下一章
      const lastPublished = chaptersData
        .filter(chapter => chapter.status === 'published')
        .sort((a, b) => b.order_index - a.order_index)[0];
      
      console.log('Last published chapter:', lastPublished);
      
      if (lastPublished) {
        const nextChapterIndex = lastPublished.order_index + 1;
        const nextChapter = chaptersData.find(ch => ch.order_index === nextChapterIndex) || 
          { id: null, title: `第${nextChapterIndex}章`, order_index: nextChapterIndex, status: 'draft' };
        console.log('Setting next chapter:', nextChapter);
        setCurrentChapter(nextChapter);
      } else {
        // 如果没有已发布章节，默认为第一章
        // 如果也没有草稿章节，则创建一个默认的第一章
        if (chaptersData.length === 0) {
          const defaultChapter = { id: null, title: '第一章', order_index: 1, status: 'draft' };
          console.log('Setting default chapter (no chapters):', defaultChapter);
          setCurrentChapter(defaultChapter);
        } else {
          // 选择第一个章节，确保不为空
          const firstChapter = chaptersData[0] || { id: null, title: '第一章', order_index: 1, status: 'draft' };
          console.log('Setting first chapter:', firstChapter);
          setCurrentChapter(firstChapter);
        }
      }
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

  const handleChapterChange = (e) => {
    const selectedId = e.target.value;
    if (selectedId === 'manual') {
      setManualChapter('');
    } else {
      const chapter = chapters.find(ch => ch.id === parseInt(selectedId));
      setCurrentChapter(chapter);
      // 加载章节内容
      if (chapter && chapter.content) {
        setContent(chapter.content);
      } else {
        setContent('');
      }
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
        status: 'draft',
        project_id: projectId
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
          <RichTextEditor content={content} onContentChange={handleContentChange} />
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
              <span className="chapter-status">
                {currentChapter.status === 'published' ? '已发布' : '草稿'}
              </span>
            )}
          </div>
          <button 
            className={`publish-button ${currentChapter?.status === 'published' ? 'published' : ''}`}
            onClick={publishChapterContent}
            disabled={isPublishing || !currentChapter}
            title={currentChapter?.status === 'published' ? "章节已发布" : "发布章节"}
          >
            <FaUpload />
            <span>{currentChapter?.status === 'published' ? '已发布' : (isPublishing ? '发布中...' : '发布')}</span>
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
    </div>
  );
};

const RichTextEditor = ({ content, onContentChange }) => {
  const handleChange = (e) => {
    onContentChange(e.target.value);
  };

  return (
    <div className="rich-text-editor">
      <textarea
        className="content-textarea"
        value={content}
        onChange={handleChange}
        placeholder="在这里开始你的创作..."
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