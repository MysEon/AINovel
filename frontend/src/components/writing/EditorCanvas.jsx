import React, { useCallback, useEffect, useState } from 'react';
import {
  FaBookOpen,
  FaBolt,
  FaLightbulb,
  FaMagic,
  FaQuestion,
  FaRobot,
  FaSpinner
} from 'react-icons/fa';
import { Input } from 'antd';
import AgentStatusBadge from './AgentStatusBadge';
import EditorAiProposalCard from './EditorAiProposalCard';

const { TextArea } = Input;

const SELECTION_ACTIONS = [
  { id: 'ask', label: '提问', icon: FaQuestion },
  { id: 'optimize', label: '优化', icon: FaMagic },
  { id: 'expand', label: '扩写', icon: FaBolt },
  { id: 'ideas', label: '发散', icon: FaLightbulb }
];

const getAnchorClass = (index = 0, text = '') => {
  const length = Math.max(text.length, 1);
  const bucket = Math.min(4, Math.max(0, Math.floor((index / length) * 5)));
  return `anchor-${bucket}`;
};

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
  onRewrite,
  editorProposal,
  onApplyProposal,
  onDismissProposal,
  onCopyProposal,
  onSelectionAction,
  selectionActionLoading
}) => {
  const [selectionState, setSelectionState] = useState(null);

  const captureSelection = useCallback((event) => {
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;

    if (readOnly || start === end) {
      setSelectionState(null);
      return;
    }

    setSelectionState({
      start,
      end,
      text: target.value.slice(start, end)
    });
  }, [readOnly]);

  useEffect(() => {
    setSelectionState(prev => {
      if (!prev) return null;
      if (prev.end > (content || '').length) return null;
      if ((content || '').slice(prev.start, prev.end) !== prev.text) return null;
      return prev;
    });
  }, [content]);

  const handleContentChange = useCallback((event) => {
    setSelectionState(null);
    onContentChange(event);
  }, [onContentChange]);

  const handleSelectionActionClick = useCallback((action) => {
    if (!selectionState || selectionActionLoading) return;
    onSelectionAction?.(action, selectionState);
  }, [onSelectionAction, selectionActionLoading, selectionState]);

  const showSelectionMenu = Boolean(selectionState?.text?.trim()) && !readOnly && !editorProposal;
  const selectionAnchorClass = selectionState ? getAnchorClass(selectionState.start, content || '') : 'anchor-0';
  const proposalAnchorClass = editorProposal?.range
    ? getAnchorClass(editorProposal.range.start, content || '')
    : 'anchor-0';

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
          onChange={handleContentChange}
          onSelect={captureSelection}
          onMouseUp={captureSelection}
          onKeyUp={captureSelection}
          placeholder="在这里创作你的小说内容..."
          readOnly={readOnly}
          className="editor-canvas-textarea"
        />
        {showSelectionMenu && (
          <div className={`editor-selection-menu ${selectionAnchorClass}`} role="toolbar" aria-label="选中文本 AI 操作">
            <span className="editor-selection-menu-label">{selectionState.text.length} 字</span>
            {SELECTION_ACTIONS.map(({ id, label, icon: Icon }) => {
              const isActionLoading = selectionActionLoading === id;
              return (
                <button
                  key={id}
                  type="button"
                  className="editor-selection-action"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelectionActionClick(id)}
                  disabled={Boolean(selectionActionLoading)}
                  title={label}
                >
                  {isActionLoading ? <FaSpinner className="selection-action-spinner" /> : <Icon />}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        )}
        {editorProposal && (
          <EditorAiProposalCard
            proposal={editorProposal}
            anchorClass={proposalAnchorClass}
            onApply={onApplyProposal}
            onDismiss={onDismissProposal}
            onCopy={onCopyProposal}
          />
        )}
        {isGenerating && (
          <div className="editor-streaming-hint" aria-hidden="true">
            <span className="editor-streaming-dot" />
            <span className="editor-streaming-caret" />
          </div>
        )}
      </div>

      {showCompletionActions && !editorProposal && (
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
