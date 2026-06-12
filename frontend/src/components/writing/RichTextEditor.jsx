import React from 'react';

const RichTextEditor = ({
  currentChapter,
  content,
  contentCharCount = 0,
  contentLineCount = 0,
  onContentChange,
  readOnly
}) => {
  const handleChange = (e) => {
    if (!readOnly) {
      onContentChange(e.target.value);
    }
  };

  return (
    <div className="rich-text-editor">
      <div className="editor-paper manuscript-paper">
        {readOnly && <div className="editor-lock-overlay">编辑区已锁定</div>}
        <div className="editor-paper-head">
          <div className="editor-paper-title">
            <span className="editor-paper-kicker">
              {currentChapter ? `第 ${currentChapter.chapter_number} 章` : '未选择章节'}
            </span>
            <h2>{currentChapter?.title || '新的章节'}</h2>
          </div>
          <div className="editor-paper-stats" aria-label="当前章节统计">
            <span>{contentCharCount} 字</span>
            <span>{contentLineCount} 行</span>
          </div>
        </div>
        <textarea
          className={`content-textarea ${readOnly ? 'locked' : ''}`}
          value={content}
          onChange={handleChange}
          placeholder="在这里开始你的创作..."
          readOnly={readOnly}
        />
      </div>
    </div>
  );
};

export default RichTextEditor;
