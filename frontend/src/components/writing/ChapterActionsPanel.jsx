import React from 'react';
import { FaEllipsisH, FaLayerGroup, FaPlus, FaUpload } from 'react-icons/fa';

const ChapterActionsPanel = ({
  currentChapter,
  isPublishing,
  onPublish,
  onBatchPublishClick,
  onNewChapterClick
}) => {
  const isPublished = currentChapter?.status === 'published';

  return (
    <details className="footer-panel footer-panel-actions footer-options-menu">
      <summary className="footer-options-trigger" title="章节操作">
        <FaEllipsisH />
        <span>更多</span>
      </summary>

      <div className="footer-options-popover footer-action-row">
        <button
          className={`publish-button footer-cta ${isPublished ? 'published' : ''}`}
          onClick={onPublish}
          disabled={isPublishing || !currentChapter || isPublished}
          title={isPublished ? '章节已发布' : '发布章节'}
        >
          <FaUpload />
          <span>{isPublished ? '已发布' : (isPublishing ? '发布中...' : '发布章节')}</span>
        </button>

        <button
          className="batch-publish-button footer-secondary-btn"
          onClick={onBatchPublishClick}
          disabled={!currentChapter}
          title="批量发布"
        >
          <FaLayerGroup />
          <span>批量发布</span>
        </button>

        <button
          className="new-chapter-button footer-secondary-btn"
          onClick={onNewChapterClick}
          title="新建章节"
        >
          <FaPlus />
          <span>新建章节</span>
        </button>
      </div>
    </details>
  );
};

export default ChapterActionsPanel;
