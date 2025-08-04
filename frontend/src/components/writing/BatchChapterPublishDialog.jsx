import React, { useState, useEffect, useCallback } from 'react';
import { FaUpload, FaTimes, FaCheck, FaList, FaVectorSquare, FaSelectAll } from 'react-icons/fa';
import ChapterItem from './ChapterItem';
import { getUnpublishedChapters, batchPublishChapters } from '../../services/chapterService';
import { useNotification } from '../NotificationManager';
import './BatchChapterPublishDialog.css';

const BatchChapterPublishDialog = ({ 
  projectId, 
  currentChapterId, 
  isOpen, 
  onClose, 
  onPublishComplete 
}) => {
  const [unpublishedChapters, setUnpublishedChapters] = useState([]);
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState({ current: 0, total: 0 });
  const [selectionMode, setSelectionMode] = useState('individual'); // 'individual', 'range', 'all'
  const [isLoading, setIsLoading] = useState(false);
  const { addNotification } = useNotification();

  // 获取未发布章节列表
  const fetchUnpublishedChapters = useCallback(async () => {
    if (!projectId || !isOpen) return;
    
    setIsLoading(true);
    try {
      const data = await getUnpublishedChapters(projectId, currentChapterId);
      setUnpublishedChapters(data.chapters || []);
      
      // 默认选择当前章节
      const currentChapter = data.chapters.find(ch => ch.is_current);
      if (currentChapter) {
        setSelectedChapters([currentChapter.id]);
      }
    } catch (error) {
      addNotification({
        message: '获取未发布章节列表失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
    } finally {
      setIsLoading(false);
    }
  }, [projectId, currentChapterId, isOpen, addNotification]);

  // 对话框打开时获取数据
  useEffect(() => {
    if (isOpen) {
      fetchUnpublishedChapters();
    } else {
      // 重置状态
      setUnpublishedChapters([]);
      setSelectedChapters([]);
      setSelectionMode('individual');
    }
  }, [isOpen, fetchUnpublishedChapters]);

  // 处理章节选择
  const handleChapterSelect = useCallback((chapterId) => {
    if (selectionMode !== 'individual') return;
    
    setSelectedChapters(prev => {
      if (prev.includes(chapterId)) {
        return prev.filter(id => id !== chapterId);
      } else {
        return [...prev, chapterId];
      }
    });
  }, [selectionMode]);

  // 处理范围选择
  const handleRangeSelect = useCallback(() => {
    if (unpublishedChapters.length === 0) return;
    
    const currentChapter = unpublishedChapters.find(ch => ch.is_current);
    if (!currentChapter) return;
    
    const currentIndex = unpublishedChapters.findIndex(ch => ch.id === currentChapter.id);
    const selectedRange = unpublishedChapters.slice(0, currentIndex + 1).map(ch => ch.id);
    
    setSelectedChapters(selectedRange);
  }, [unpublishedChapters]);

  // 处理全选
  const handleSelectAll = useCallback(() => {
    const allIds = unpublishedChapters.map(ch => ch.id);
    setSelectedChapters(allIds);
  }, [unpublishedChapters]);

  // 根据选择模式自动选择章节
  useEffect(() => {
    if (!isOpen || unpublishedChapters.length === 0) return;
    
    if (selectionMode === 'range') {
      handleRangeSelect();
    } else if (selectionMode === 'all') {
      handleSelectAll();
    }
  }, [selectionMode, isOpen, unpublishedChapters, handleRangeSelect, handleSelectAll]);

  // 执行批量发布
  const handleBatchPublish = async () => {
    if (selectedChapters.length === 0) {
      addNotification({
        message: '请至少选择一个要发布的章节',
        type: 'warning',
        duration: 3000
      });
      return;
    }

    setIsPublishing(true);
    setPublishProgress({ current: 0, total: selectedChapters.length });

    try {
      const result = await batchPublishChapters(selectedChapters, projectId);
      
      // 显示发布结果
      const successMessage = `成功发布 ${result.success_count} 个章节`;
      const errorMessage = result.failed_chapters.length > 0 
        ? `，${result.failed_chapters.length} 个章节发布失败` 
        : '';
      
      addNotification({
        message: successMessage + errorMessage,
        type: result.failed_chapters.length === 0 ? 'success' : 'warning',
        duration: 5000
      });

      // 通知父组件发布完成
      if (onPublishComplete) {
        onPublishComplete(result);
      }
      
      // 关闭对话框
      onClose();
      
    } catch (error) {
      addNotification({
        message: '批量发布失败: ' + error.message,
        type: 'error',
        duration: 5000
      });
    } finally {
      setIsPublishing(false);
      setPublishProgress({ current: 0, total: 0 });
    }
  };

  // 获取选中的章节数量描述
  const getSelectedCountText = () => {
    if (selectedChapters.length === 0) return '未选择章节';
    if (selectedChapters.length === 1) return '已选择 1 个章节';
    return `已选择 ${selectedChapters.length} 个章节`;
  };

  if (!isOpen) return null;

  return (
    <div className="batch-publish-dialog-overlay">
      <div className="batch-publish-dialog">
        <div className="dialog-header">
          <h2>
            <FaUpload className="dialog-icon" />
            批量发布章节
          </h2>
          <button className="close-button" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        {/* 选择模式切换 */}
        <div className="selection-modes">
          <button 
            className={`mode-button ${selectionMode === 'individual' ? 'active' : ''}`}
            onClick={() => setSelectionMode('individual')}
            title="手动选择要发布的章节"
          >
            <FaList />
            <span>单个选择</span>
          </button>
          <button 
            className={`mode-button ${selectionMode === 'range' ? 'active' : ''}`}
            onClick={() => setSelectionMode('range')}
            title="选择当前章节及之前的所有章节"
          >
            <FaVectorSquare />
            <span>范围选择</span>
          </button>
          <button 
            className={`mode-button ${selectionMode === 'all' ? 'active' : ''}`}
            onClick={() => setSelectionMode('all')}
            title="选择所有未发布的章节"
          >
            <FaSelectAll />
            <span>全选</span>
          </button>
        </div>

        {/* 选择状态 */}
        <div className="selection-status">
          <span className="status-text">{getSelectedCountText()}</span>
          <span className="total-text">共 {unpublishedChapters.length} 个未发布章节</span>
        </div>

        {/* 章节列表 */}
        <div className="chapters-list">
          {isLoading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>正在加载章节列表...</p>
            </div>
          ) : unpublishedChapters.length === 0 ? (
            <div className="empty-state">
              <p>没有找到未发布的章节</p>
            </div>
          ) : (
            unpublishedChapters.map(chapter => (
              <ChapterItem 
                key={chapter.id}
                chapter={chapter}
                isSelected={selectedChapters.includes(chapter.id)}
                onSelect={() => handleChapterSelect(chapter.id)}
                selectionMode={selectionMode}
              />
            ))
          )}
        </div>

        {/* 进度条 */}
        {isPublishing && (
          <div className="progress-section">
            <div className="progress-info">
              <span>正在发布章节...</span>
              <span>{publishProgress.current} / {publishProgress.total}</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ 
                  width: `${(publishProgress.current / publishProgress.total) * 100}%` 
                }} 
              />
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="dialog-actions">
          <button 
            className="cancel-button" 
            onClick={onClose}
            disabled={isPublishing}
          >
            取消
          </button>
          <button 
            className="publish-button" 
            onClick={handleBatchPublish}
            disabled={selectedChapters.length === 0 || isPublishing || isLoading}
          >
            {isPublishing ? (
              <>
                <div className="button-spinner"></div>
                发布中...
              </>
            ) : (
              <>
                <FaUpload />
                发布选中章节 ({selectedChapters.length})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchChapterPublishDialog;