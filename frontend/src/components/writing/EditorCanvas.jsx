import React from 'react';
import { FaBookOpen, FaMagic, FaRobot } from 'react-icons/fa';
import { Input } from 'antd';
import AgentStatusBadge from './AgentStatusBadge';

const { TextArea } = Input;

const EditorCanvas = ({
  currentChapter,
  content,
  contentCharCount = 0,
  contentLineCount = 0,
  onContentChange,
  readOnly,
  isGenerating = false,
  agentStatuses = [],
  selectedModelName,
  showCompletionActions = false,
  onAccept,
  onRewrite
}) => {
  return (
    <div className={`editor-canvas-shell ${isGenerating ? 'is-generating' : ''}`}>
      <div className="editor-canvas-toolbar">
        <div className="editor-canvas-tools" aria-label="AI 写作状态">
          <span className="canvas-tool-chip ai">
            <FaMagic />
            <span>AI 助手</span>
          </span>
        </div>
        <div className="editor-canvas-toolbar-meta">
          {selectedModelName && (
            <span className="editor-meta-pill">
              <FaRobot />
              <span>{selectedModelName}</span>
            </span>
          )}
          {isGenerating && (
            <span className="editor-meta-pill generating">
              <span className="mini-spinner" aria-hidden="true" />
              <span>AI 正在构思中...</span>
            </span>
          )}
        </div>
      </div>

      {agentStatuses.length > 0 && (
        <div className="editor-agent-strip" aria-live="polite">
          {agentStatuses.map((agent) => (
            <AgentStatusBadge
              key={agent.id}
              name={agent.name}
              status={agent.status}
              active={agent.active}
              tone={agent.tone}
            />
          ))}
        </div>
      )}

      <div className="editor-paper">
        {readOnly && <div className="editor-lock-overlay modern">编辑区已锁定</div>}
        <div className="editor-paper-head">
          <div className="editor-paper-title">
            <span className="editor-paper-kicker">
              {currentChapter ? `第 ${currentChapter.chapter_number} 章` : '未选择章节'}
            </span>
            <h2>{currentChapter?.title || '新的章节'}</h2>
          </div>
          <div className="editor-paper-stats" aria-label="当前章节统计">
            <span>
              <FaBookOpen />
              {contentCharCount} 字
            </span>
            <span>{contentLineCount} 行</span>
          </div>
        </div>
        <TextArea
          value={content}
          onChange={onContentChange}
          placeholder="在这里创作你的小说内容..."
          readOnly={readOnly}
          className="editor-canvas-textarea"
        />
        {isGenerating && (
          <div className="editor-streaming-hint" aria-hidden="true">
            <span className="editor-streaming-dot" />
            <span className="editor-streaming-caret" />
          </div>
        )}
      </div>

      {showCompletionActions && (
        <div className="editor-completion-bar">
          <div className="completion-copy">AI 生成完成，可预览后选择下一步</div>
          <div className="completion-actions">
            <button type="button" className="completion-btn ghost" onClick={onRewrite}>
              重写
            </button>
            <button type="button" className="completion-btn primary" onClick={onAccept}>
              采纳
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditorCanvas;
