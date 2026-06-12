import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FaUpload, FaTimes, FaCheck, FaChevronRight, FaBook, FaExclamationTriangle } from 'react-icons/fa';
import './BatchChapterPublishDialog.css';

const BatchChapterPublishDialog = ({
  projectId,
  currentChapter,
  chapters,
  onClose,
  onPublish,
  triggerPosition
}) => {
  const [selectedChapters, setSelectedChapters] = useState(new Set());
  const [publishing, setPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState({ current: 0, total: 0 });
  const [showConfirm, setShowConfirm] = useState(false);
  const [rangeSelecting, setRangeSelecting] = useState(false);
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);

  // 获取未发布的章节
  const unpublishedChapters = chapters
    .filter(ch => ch.status === 'draft')
    .sort((a, b) => a.chapter_number - b.chapter_number);
  const selectedChapterList = unpublishedChapters.filter(ch => selectedChapters.has(ch.id));

  // 计算对话框位置
  const getDialogStyle = () => {
    if (!triggerPosition) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        '--arrow-display': 'none'
      };
    }
    
    const margin = window.innerWidth <= 768 ? 8 : 20; // 边距
    const dialogWidth = Math.min(500, window.innerWidth - margin * 2); // 预估对话框宽度
    const preferredHeight = Math.min(520, window.innerHeight - margin * 2); // 预估对话框高度
    const triggerCenter = triggerPosition.left + triggerPosition.width / 2;
    const belowSpace = window.innerHeight - triggerPosition.bottom - margin;
    
    let left = triggerCenter - dialogWidth / 2;
    let arrowPosition = 'top'; // 箭头位置：top 或 bottom
    const style = {
      position: 'fixed',
      zIndex: 1000
    };
    
    // 确保不超出右边界
    if (left + dialogWidth > window.innerWidth - margin) {
      left = window.innerWidth - dialogWidth - margin;
    }
    
    // 确保不超出左边界
    if (left < margin) {
      left = margin;
    }
    
    // 如果下方空间不够，贴着按钮上方显示。用 bottom 锚定可避免实际高度和预估高度不一致造成间距漂移。
    if (belowSpace < preferredHeight) {
      style.bottom = window.innerHeight - triggerPosition.top + 10;
      arrowPosition = 'bottom';
    } else {
      style.top = triggerPosition.bottom + 10;
    }

    if (style.bottom !== undefined) {
      const maxBottom = window.innerHeight - margin;
      if (style.bottom > maxBottom) {
        style.bottom = maxBottom;
      }
    }

    const arrowLeft = Math.max(16, Math.min(dialogWidth - 16, triggerCenter - left));
    
    return {
      ...style,
      left,
      '--arrow-position': arrowPosition,
      '--arrow-left': `${arrowLeft}px`,
      '--arrow-display': 'block'
    };
  };

  // 选择/取消选择章节
  const toggleChapter = (chapterId) => {
    const newSelected = new Set(selectedChapters);
    if (newSelected.has(chapterId)) {
      newSelected.delete(chapterId);
    } else {
      newSelected.add(chapterId);
    }
    setSelectedChapters(newSelected);
    // 清除范围选择
    setRangeSelecting(false);
    setRangeStart(null);
    setRangeEnd(null);
  };

  // 范围选择
  const handleRangeSelect = (chapter) => {
    if (!rangeStart) {
      setRangeStart(chapter);
      setRangeEnd(null);
      setSelectedChapters(new Set([chapter.id]));
    } else {
      const start = Math.min(rangeStart.chapter_number, chapter.chapter_number);
      const end = Math.max(rangeStart.chapter_number, chapter.chapter_number);
      const rangeChapters = unpublishedChapters.filter(ch => 
        ch.chapter_number >= start && ch.chapter_number <= end
      );
      const newSelected = new Set(rangeChapters.map(ch => ch.id));
      setSelectedChapters(newSelected);
      setRangeEnd(chapter);
      setRangeSelecting(false);
    }
  };

  const startRangeSelection = () => {
    setRangeSelecting(true);
    setRangeStart(null);
    setRangeEnd(null);
    setSelectedChapters(new Set());
  };

  // 全选
  const selectAll = () => {
    const newSelected = new Set(unpublishedChapters.map(ch => ch.id));
    setSelectedChapters(newSelected);
    setRangeStart(null);
    setRangeEnd(null);
    setRangeSelecting(false);
  };

  // 一键发布当前章节及之前的草稿
  const publishCurrentAndPrevious = () => {
    if (!currentChapter) return;

    const currentAndPrevious = unpublishedChapters.filter(ch => 
      ch.chapter_number <= currentChapter.chapter_number
    );
    const newSelected = new Set(currentAndPrevious.map(ch => ch.id));
    setSelectedChapters(newSelected);
    setRangeStart(null);
    setRangeEnd(null);
    setRangeSelecting(false);
  };

  // 开始批量发布
  const startPublish = () => {
    if (selectedChapters.size === 0) return;
    setShowConfirm(true);
  };

  // 确认发布
  const confirmPublish = async () => {
    const chaptersToPublish = Array.from(selectedChapters).map(id => 
      unpublishedChapters.find(ch => ch.id === id)
    );
    
    setPublishing(true);
    setPublishProgress({ current: 0, total: chaptersToPublish.length });
    setShowConfirm(false);
    setRangeSelecting(false);

    try {
      await onPublish(chaptersToPublish, (progress) => {
        setPublishProgress(progress);
      });
      onClose();
    } catch (error) {
      console.error('批量发布失败:', error);
    } finally {
      setPublishing(false);
    }
  };

  // 获取章节状态标签
  const getStatusLabel = (chapter) => {
    if (chapter.id === currentChapter?.id) {
      return { text: '当前章节', className: 'current-chapter' };
    }
    if (rangeStart?.id === chapter.id) {
      return { text: '范围起点', className: 'range-start' };
    }
    if (rangeEnd?.id === chapter.id) {
      return { text: '范围终点', className: 'range-end' };
    }
    return { text: '', className: '' };
  };

  if (publishing) {
    const dialogStyle = getDialogStyle();
    const arrowPosition = dialogStyle['--arrow-position'] || 'top';
    
    return createPortal(
      <div className="batch-publish-dialog publishing" style={dialogStyle}>
        {/* 箭头指向触发按钮 */}
        <div className={`dialog-arrow arrow-${arrowPosition}`} />
        
        <div className="publishing-content">
          <div className="publishing-icon">
            <FaUpload />
          </div>
          <h3>批量发布中...</h3>
          <div className="progress-info">
            <span>{publishProgress.current} / {publishProgress.total}</span>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${(publishProgress.current / publishProgress.total) * 100}%` }}
              />
            </div>
          </div>
          <p className="publishing-tip">正在发布章节，请稍候...</p>
        </div>
      </div>,
      document.body
    );
  }

  const dialogStyle = getDialogStyle();
  const arrowPosition = dialogStyle['--arrow-position'] || 'top';
  
  return createPortal(
    <div className="batch-publish-dialog" style={dialogStyle}>
      {/* 箭头指向触发按钮 */}
      <div className={`dialog-arrow arrow-${arrowPosition}`} />
      
      <div className="dialog-header">
        <div className="header-title-group">
          <h3><FaUpload /> 批量发布章节</h3>
          <p className="dialog-subtitle">
            未发布章节 {unpublishedChapters.length} 个，已选择 {selectedChapters.size} 个
          </p>
        </div>
        <button className="close-btn" onClick={onClose}>
          <FaTimes />
        </button>
      </div>

      <div className="dialog-content">
        <div className="action-buttons">
          <button 
            className="action-btn primary" 
            onClick={publishCurrentAndPrevious}
            disabled={unpublishedChapters.length === 0 || !currentChapter}
          >
            <FaChevronRight />
            发布当前及之前章节
          </button>
          <button 
            className="action-btn" 
            onClick={selectAll}
            disabled={unpublishedChapters.length === 0}
          >
            <FaCheck />
            全选
          </button>
          <button
            className={`action-btn ${rangeSelecting ? 'active' : ''}`}
            onClick={rangeSelecting ? () => {
              setRangeSelecting(false);
              setRangeStart(null);
              setRangeEnd(null);
            } : startRangeSelection}
            disabled={unpublishedChapters.length < 2}
          >
            {rangeSelecting ? '取消范围选择' : '范围选择'}
          </button>
          <button 
            className="action-btn" 
            onClick={() => setSelectedChapters(new Set())}
            disabled={selectedChapters.size === 0}
          >
            清除选择
          </button>
        </div>

        {rangeSelecting && (
          <div className="range-select-banner">
            {rangeStart
              ? `已选择起点：第${rangeStart.chapter_number}章，请点击终点章节`
              : '范围选择模式：请先点击起点章节，再点击终点章节'}
          </div>
        )}

        <div className="chapters-list">
          <div className="list-header">
            <span>选择要发布的章节</span>
            <span className="chapter-count">
              已选择: {selectedChapters.size} / {unpublishedChapters.length}
            </span>
          </div>

          {unpublishedChapters.length === 0 ? (
            <div className="empty-state">
              <FaBook />
              <p>暂无未发布的章节</p>
            </div>
          ) : (
            <div className={`chapters-scroll ${rangeSelecting ? 'range-mode' : ''}`}>
              {unpublishedChapters.map(chapter => {
                  const status = getStatusLabel(chapter);
                  const isSelected = selectedChapters.has(chapter.id);
                  const isRangeMode = rangeSelecting;
                  
                  return (
                    <div
                      key={chapter.id}
                      className={`chapter-item ${isSelected ? 'selected' : ''} ${status.className} ${isRangeMode ? 'range-mode' : ''}`}
                      onClick={() => isRangeMode ? handleRangeSelect(chapter) : toggleChapter(chapter.id)}
                    >
                      <div className="chapter-checkbox">
                        <FaCheck className={`check-icon ${isSelected ? 'visible' : ''}`} />
                      </div>
                      <div className="chapter-info">
                        <div className="chapter-title">
                          第{chapter.chapter_number}章 {chapter.title}
                        </div>
                        {status.text && (
                          <span className="status-label">{status.text}</span>
                        )}
                      </div>
                      {isRangeMode && (
                        <div className="range-hint">
                          {rangeStart?.id === chapter.id
                            ? '起点'
                            : (rangeStart ? '可作为终点' : '可作为起点')}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <div className="footer-summary">
            {selectedChapters.size > 0
              ? `将发布 ${selectedChapters.size} 个章节`
              : '请选择至少 1 个章节'}
          </div>
          <div className="footer-actions">
            <button className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
            <button 
              className="btn btn-primary" 
              onClick={startPublish}
              disabled={selectedChapters.size === 0}
            >
              <FaUpload />
              发布选中的 {selectedChapters.size} 个章节
            </button>
          </div>
        </div>
      </div>

      {/* 确认对话框 */}
      {showConfirm && (
        <div className="confirm-overlay" onClick={() => setShowConfirm(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-header">
              <FaExclamationTriangle className="warning-icon" />
              <h3>确认批量发布</h3>
            </div>
            <div className="confirm-content">
              <p>您即将发布以下 {selectedChapters.size} 个章节：</p>
              <div className="confirm-chapters-list">
                {selectedChapterList.map(chapter => {
                  return (
                    <div key={chapter.id} className="confirm-chapter-item">
                      第{chapter.chapter_number}章 {chapter.title}
                    </div>
                  );
                })}
              </div>
              <p className="confirm-warning">发布后章节将对读者可见，确定要继续吗？</p>
            </div>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={confirmPublish}>
                确认发布
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default BatchChapterPublishDialog;
