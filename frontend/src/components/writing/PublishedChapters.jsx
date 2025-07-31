import React, { useState, useEffect, useCallback } from 'react';
import { FaBook, FaEye, FaDownload, FaShare, FaEdit, FaTrash } from 'react-icons/fa';
import { getChapters, deleteChapter } from '../../services/chapterService';
import { useNotification } from '../NotificationManager';
import './PublishedChapters.css';

const PublishedChapters = ({ projectId, onProjectsChange }) => {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const { addNotification, showConfirmDialog } = useNotification();

  // 获取已发布的章节
  useEffect(() => {
    if (projectId) {
      fetchPublishedChapters();
    }
  }, [projectId]);

  const fetchPublishedChapters = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const allChapters = await getChapters(projectId);
      const publishedChapters = allChapters.filter(chapter => chapter.status === 'published');
      setChapters(publishedChapters);
    } catch (error) {
      addNotification({
        message: '获取已发布章节失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, addNotification]);

  // 查看章节内容
  const viewChapter = (chapter) => {
    setSelectedChapter(chapter);
  };

  // 编辑章节
  const editChapter = (chapter) => {
    // 在实际实现中，这里应该导航到编辑页面
    // 我们可以通过更新URL来导航到写作界面，并传递章节ID
    // 但现在我们只是显示一个通知
    addNotification({
      message: `编辑章节功能将在后续版本中实现`,
      type: 'info',
      duration: 2000
    });
  };

  // 删除章节
  const handleDeleteChapter = async (chapterId) => {
    // 使用全局确认对话框
    showConfirmDialog({
      title: '删除章节',
      message: '确定要删除这个章节吗？此操作不可撤销。',
      type: 'warning',
      showResultNotification: true,
      successMessage: '章节删除成功',
      errorMessage: '删除章节失败',
      onConfirm: async () => {
        try {
          await deleteChapter(chapterId);
          // 从状态中移除已删除的章节
          setChapters(prevChapters => prevChapters.filter(chapter => chapter.id !== chapterId));
          if (onProjectsChange) {
            onProjectsChange();
          }
        } catch (error) {
          throw new Error('删除章节失败: ' + error.message);
        }
      }
    });
  };

  // 导出章节
  const exportChapter = (chapter) => {
    // 在实际实现中，这里应该调用导出API
    // 现在我们只是显示一个通知
    addNotification({
      message: `导出功能将在后续版本中实现`,
      type: 'info',
      duration: 2000
    });
  };

  // 分享章节
  const shareChapter = (chapter) => {
    // 在实际实现中，这里应该调用分享API
    // 现在我们只是显示一个通知
    addNotification({
      message: `分享功能将在后续版本中实现`,
      type: 'info',
      duration: 2000
    });
  };

  // 关闭章节详情
  const closeChapterDetail = () => {
    setSelectedChapter(null);
  };

  if (loading) {
    return (
      <div className="published-chapters">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  return (
    <div className="published-chapters">
      <div className="chapters-header">
        <h2>已发布章节</h2>
        <div className="chapters-stats">
          <span>共 {chapters.length} 章节</span>
        </div>
      </div>

      {chapters.length === 0 ? (
        <div className="empty-state">
          <FaBook className="empty-icon" />
          <h3>暂无已发布章节</h3>
          <p>您还没有发布任何章节，请先在写作界面完成创作并发布。</p>
        </div>
      ) : (
        <div className="chapters-content">
          <div className="chapters-grid">
            {chapters.map((chapter) => (
              <div key={chapter.id} className="chapter-card">
                <div className="chapter-header">
                  <h3>{chapter.title}</h3>
                  <div className="chapter-meta">
                    <span className="word-count">{chapter.word_count || 0} 字</span>
                    <span className="publish-date">
                      {new Date(chapter.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="chapter-preview">
                  {chapter.content?.substring(0, 100)}...
                </div>
                <div className="chapter-actions">
                  <button 
                    className="action-button view-button"
                    onClick={() => viewChapter(chapter)}
                    title="查看"
                  >
                    <FaEye />
                  </button>
                  <button 
                    className="action-button edit-button"
                    onClick={() => editChapter(chapter)}
                    title="编辑"
                  >
                    <FaEdit />
                  </button>
                  <button 
                    className="action-button export-button"
                    onClick={() => exportChapter(chapter)}
                    title="导出"
                  >
                    <FaDownload />
                  </button>
                  <button 
                    className="action-button share-button"
                    onClick={() => shareChapter(chapter)}
                    title="分享"
                  >
                    <FaShare />
                  </button>
                  <button 
                    className="action-button delete-button"
                    onClick={() => handleDeleteChapter(chapter.id)}
                    title="删除"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedChapter && (
        <div className="chapter-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{selectedChapter.title}</h2>
              <button className="close-button" onClick={closeChapterDetail}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="chapter-content">
                {selectedChapter.content}
              </div>
            </div>
            <div className="modal-footer">
              <button className="close-modal-button" onClick={closeChapterDetail}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublishedChapters;