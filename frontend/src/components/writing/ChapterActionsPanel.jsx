import React from 'react';
import { FaUpload, FaLayerGroup, FaPlus } from 'react-icons/fa';

const ChapterActionsPanel = ({
  currentChapter,
  isPublishing,
  canPublishCurrentChapter,
  hasCurrentChapter,
  onPublish,
  onBatchPublishClick,
  onNewChapterClick
}) => {
  return (
    <div className="footer-panel footer-panel-actions">
      <div className="footer-panel-head compact">
        <div className="footer-panel-title">
          <FaUpload />
          <span>发布与章节</span>
        </div>
      </div>

      <div className="footer-action-row">
        <button
          className={`publish-button footer-cta ${currentChapter?.status === 'published' ? 'published' : ''}`}
          onClick={onPublish}
          disabled={isPublishing || !currentChapter || currentChapter.status === 'published'}
          title={currentChapter?.status === 'published' ? "章节已发布" : "发布章节"}
        >
          <FaUpload />
          <span>
            {currentChapter?.status === 'published' ? '已发布' : (isPublishing ? '发布中...' : '发布章节')}
          </span>
        </button>

        <button
          className="batch-publish-button footer-secondary-btn"
          onClick={onBatchPublishClick}
          disabled={!currentChapter}
          title="批量发布多个章节"
        >
          <FaLayerGroup />
          <span>批量发布</span>
        </button>

        <button
          className="new-chapter-button footer-secondary-btn"
          onClick={onNewChapterClick}
          title="开启一个全新的章节"
        >
          <FaPlus />
          <span>开启新章</span>
        </button>
      </div>

      <div className="footer-panel-subtext">
        {hasCurrentChapter
          ? (canPublishCurrentChapter ? '发布会将当前章节状态变更为“已发布”。' : '可先保存草稿，再按需发布。')
          : '请先创建或选择章节。'}
      </div>
    </div>
  );
};

export default ChapterActionsPanel;
