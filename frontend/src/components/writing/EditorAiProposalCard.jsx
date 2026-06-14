import React from 'react';
import {
  FaCheck,
  FaClipboard,
  FaExchangeAlt,
  FaLevelDownAlt,
  FaPlus,
  FaTimes
} from 'react-icons/fa';

const PREVIEW_LIMIT = 900;

const clipPreview = (text = '') => {
  if (text.length <= PREVIEW_LIMIT) return text;
  return `${text.slice(0, PREVIEW_LIMIT)}...`;
};

const ACTION_LABELS = {
  'replace-selection': '替换选中',
  'insert-after-selection': '插入选区后',
  'replace-all': '替换全文',
  append: '追加到末尾'
};

const EditorAiProposalCard = ({
  proposal,
  anchorClass = 'anchor-0',
  onApply,
  onDismiss,
  onCopy
}) => {
  if (!proposal) return null;

  const hasRange = Boolean(proposal.range);
  const hasOriginal = Boolean(proposal.originalText?.trim());
  const primaryMode = proposal.applyMode || 'append';
  const showCompare = hasOriginal && (proposal.originalText.length > 160 || proposal.proposedText.length > 160);
  const secondaryModes = [
    hasRange && primaryMode !== 'insert-after-selection' ? 'insert-after-selection' : null,
    primaryMode !== 'append' ? 'append' : null,
    proposal.canReplaceAll && primaryMode !== 'replace-all' ? 'replace-all' : null
  ].filter(Boolean);

  return (
    <aside
      className={`editor-ai-proposal-card ${anchorClass} ${proposal.isReference ? 'is-reference' : ''}`}
      aria-label="AI 提案"
      aria-live="polite"
    >
      <header className="editor-ai-proposal-header">
        <div className="editor-ai-proposal-title">
          <span className="editor-ai-proposal-kicker">{proposal.sourceLabel || 'AI 提案'}</span>
          <strong>{proposal.title || 'AI 提案'}</strong>
        </div>
        <button
          type="button"
          className="editor-ai-proposal-icon-btn"
          onClick={onDismiss}
          title="放弃提案"
          aria-label="放弃提案"
        >
          <FaTimes />
        </button>
      </header>

      {showCompare ? (
        <div className="editor-ai-proposal-compare">
          <section>
            <span>原文</span>
            <p>{clipPreview(proposal.originalText)}</p>
          </section>
          <section>
            <span>AI 建议</span>
            <p>{clipPreview(proposal.proposedText)}</p>
          </section>
        </div>
      ) : (
        <>
          {hasOriginal && (
            <div className="editor-ai-proposal-context">
              <span>原文</span>
              <p>{clipPreview(proposal.originalText)}</p>
            </div>
          )}
          <div className="editor-ai-proposal-preview">
            <span>AI 建议</span>
            <p>{clipPreview(proposal.proposedText)}</p>
          </div>
        </>
      )}

      <div className="editor-ai-proposal-meta">
        <span>{proposal.proposedText?.length || 0} 字</span>
        {proposal.isReference && <span>参考内容</span>}
        {showCompare && <span>对照预览</span>}
      </div>

      <div className="editor-ai-proposal-actions">
        <button
          type="button"
          className="editor-ai-proposal-btn primary"
          onClick={() => onApply(primaryMode)}
        >
          {primaryMode === 'append' && <FaPlus />}
          {primaryMode === 'replace-all' && <FaExchangeAlt />}
          {primaryMode === 'replace-selection' && <FaCheck />}
          {primaryMode === 'insert-after-selection' && <FaLevelDownAlt />}
          <span>{ACTION_LABELS[primaryMode] || '采纳'}</span>
        </button>
        {secondaryModes.map((mode) => (
          <button
            key={mode}
            type="button"
            className="editor-ai-proposal-btn subtle"
            onClick={() => onApply(mode)}
          >
            <span>{ACTION_LABELS[mode]}</span>
          </button>
        ))}
        <button
          type="button"
          className="editor-ai-proposal-btn icon"
          onClick={onCopy}
          title="复制提案"
          aria-label="复制提案"
        >
          <FaClipboard />
        </button>
      </div>
    </aside>
  );
};

export default EditorAiProposalCard;
