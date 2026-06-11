import React from 'react';
import { FaBook, FaLockOpen } from 'react-icons/fa';

const ChapterList = ({
  chapters,
  currentChapter,
  isEditorLocked,
  onChapterChange,
  onUnlockClick
}) => {
  const isCurrentPublished = currentChapter?.status === 'published';

  return (
    <div className="footer-panel footer-panel-chapter">
      <div className="footer-panel-head">
        <div className="footer-panel-title">
          <FaBook />
          <span>章节导航</span>
        </div>
        <div className="footer-panel-meta">
          {currentChapter && (
            <span className="footer-chip">
              第 {currentChapter.chapter_number} 章
            </span>
          )}
          {currentChapter && (
            <span className={`chapter-status ${currentChapter.status}`}>
              {currentChapter.status === 'published' ? '已发布' : '草稿'}
            </span>
          )}
          {isEditorLocked && (
            <span className="footer-chip warning">编辑锁定</span>
          )}
        </div>
      </div>

      <div className="chapter-selector">
        <label>当前章节</label>
        <select value={currentChapter?.id || ''} onChange={onChapterChange}>
          {chapters.map(chapter => (
            <option key={chapter.id} value={chapter.id}>
              第{chapter.chapter_number}章 {chapter.title} ({chapter.status === 'published' ? '已发布' : '草稿'})
            </option>
          ))}
        </select>
        {isEditorLocked && (
          <button
            className="action-btn unlock-btn footer-icon-action"
            onClick={onUnlockClick}
            title="解锁章节并回退后续发布状态"
          >
            <FaLockOpen />
          </button>
        )}
      </div>

      {currentChapter && (
        <div className="footer-panel-subtext">
          {isCurrentPublished
            ? '当前章节已发布，编辑前需先解锁。'
            : '当前章节为草稿，可继续编辑并发布。'}
        </div>
      )}
    </div>
  );
};

export default ChapterList;
