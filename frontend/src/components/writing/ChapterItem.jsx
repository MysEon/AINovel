import React from 'react';

const ChapterItem = ({ chapter, isSelected, onSelect, selectionMode }) => {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`chapter-item ${isSelected ? 'selected' : ''} ${chapter.is_current ? 'current' : ''}`}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onSelect}
        disabled={selectionMode !== 'individual'}
        className="chapter-checkbox"
      />
      <div className="chapter-info">
        <div className="chapter-header">
          <span className="chapter-title">{chapter.title}</span>
          <span className="chapter-order">第{chapter.chapter_number}章</span>
          {chapter.is_current && (
            <span className="current-chapter-badge">当前章节</span>
          )}
        </div>
        <div className="chapter-meta">
          <span className="chapter-date">更新于: {formatDate(chapter.updated_at)}</span>
          <span className="chapter-preview">
            {chapter.content || '暂无内容'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChapterItem;