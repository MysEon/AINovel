import React, { useEffect, useMemo, useState } from 'react';
import {
  FaCheck,
  FaChevronDown,
  FaExclamationTriangle,
  FaLink,
  FaProjectDiagram,
  FaRegClock,
  FaSyncAlt,
  FaTimes,
} from 'react-icons/fa';
import './ProposalReviewList.css';

const ENTITY_LABELS = {
  character: '角色',
  location: '地点',
  organization: '组织',
  worldview: '世界观',
};

const OPERATION_LABELS = {
  entity_field_update: '字段',
  relationship_upsert: '关系',
  relationship_delete: '断开',
  entity_state_event: '状态',
};

const STATUS_LABELS = {
  pending: '待审',
  conflicted: '冲突',
  accepted: '已应用',
  rejected: '已拒绝',
};

const SELECTABLE_STATUSES = new Set(['pending', 'conflicted']);

const isSelectableOperation = (operation) => SELECTABLE_STATUSES.has(operation.status);

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '空';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const truncate = (value, length = 72) => {
  const text = formatValue(value).trim();
  return text.length > length ? `${text.slice(0, length)}...` : text;
};

const getDraftOperation = (proposal, operation) =>
  proposal?.raw_payload?.draft?.operations?.[operation.sort_order] || {};

const resolveEntityName = (proposal, operation, type, id, resolver, role = 'entity') => {
  const draft = getDraftOperation(proposal, operation);
  const draftName = role === 'target' ? draft.target_name : draft.entity_name;
  return draftName || resolver?.(type, id) || `${ENTITY_LABELS[type] || type || '实体'} #${id || '-'}`;
};

const getOperationIcon = (operationType) => {
  if (operationType === 'relationship_upsert' || operationType === 'relationship_delete') return FaLink;
  if (operationType === 'entity_state_event') return FaRegClock;
  return FaProjectDiagram;
};

const describeOperation = (proposal, operation, resolver) => {
  const source = resolveEntityName(proposal, operation, operation.entity_type, operation.entity_id, resolver);
  const target = resolveEntityName(proposal, operation, operation.target_type, operation.target_id, resolver, 'target');

  if (operation.operation_type === 'entity_field_update') {
    return `${source} / ${operation.field_name || '字段'} -> ${truncate(operation.new_value, 48)}`;
  }
  if (operation.operation_type === 'relationship_upsert') {
    return `${source} ${operation.relation_type || '关联'} ${target}`;
  }
  if (operation.operation_type === 'relationship_delete') {
    return `${source} 断开 ${operation.relation_type || '关系'} ${target}`;
  }
  if (operation.operation_type === 'entity_state_event') {
    return `${source} / ${operation.state_key || '状态'} -> ${truncate(operation.new_value, 48)}`;
  }
  return `${source} / ${operation.operation_type}`;
};

const buildDefaultSelection = (proposals) => {
  const next = {};
  proposals.forEach((proposal) => {
    next[proposal.id] = proposal.operations
      .filter(isSelectableOperation)
      .map((operation) => operation.id);
  });
  return next;
};

const ProposalReviewList = ({
  proposals = [],
  loading = false,
  compact = false,
  title = '知识变更',
  subtitle = '待审实体影响',
  emptyText = '暂无待审变更',
  refreshLabel = '刷新',
  analyzeLabel = '分析本章',
  analyzing = false,
  statusText = '',
  onRefresh,
  onAnalyze,
  onAccept,
  onReject,
  entityNameResolver,
}) => {
  const [selectedByProposal, setSelectedByProposal] = useState({});
  const [openByProposal, setOpenByProposal] = useState({});
  const visibleProposals = useMemo(() => proposals || [], [proposals]);

  useEffect(() => {
    setSelectedByProposal(buildDefaultSelection(visibleProposals));
    setOpenByProposal((previous) => {
      const next = {};
      visibleProposals.forEach((proposal, index) => {
        next[proposal.id] = previous[proposal.id] ?? index < 2;
      });
      return next;
    });
  }, [visibleProposals]);

  const toggleOperation = (proposalId, operationId) => {
    setSelectedByProposal((previous) => {
      const current = new Set(previous[proposalId] || []);
      if (current.has(operationId)) current.delete(operationId);
      else current.add(operationId);
      return { ...previous, [proposalId]: Array.from(current) };
    });
  };

  const toggleAll = (proposal) => {
    const selectableIds = proposal.operations.filter(isSelectableOperation).map((operation) => operation.id);
    setSelectedByProposal((previous) => {
      const current = previous[proposal.id] || [];
      return {
        ...previous,
        [proposal.id]: current.length === selectableIds.length ? [] : selectableIds,
      };
    });
  };

  const toggleOpen = (proposalId) => {
    setOpenByProposal((previous) => ({ ...previous, [proposalId]: !previous[proposalId] }));
  };

  return (
    <section className={`proposal-review-list ${compact ? 'compact' : ''}`}>
      <header className="proposal-review-header">
        <div>
          <span className="proposal-review-kicker">{subtitle}</span>
          <h3>{title}</h3>
        </div>
        <div className="proposal-review-actions">
          {statusText && <span className="proposal-review-status">{statusText}</span>}
          {onAnalyze && (
            <button type="button" className="proposal-review-button primary" onClick={onAnalyze} disabled={analyzing || loading}>
              {analyzing ? <FaSyncAlt className="spin" /> : <FaProjectDiagram />}
              {analyzeLabel}
            </button>
          )}
          {onRefresh && (
            <button type="button" className="proposal-review-icon-button" onClick={onRefresh} disabled={loading || analyzing} aria-label={refreshLabel} title={refreshLabel}>
              <FaSyncAlt className={loading ? 'spin' : ''} />
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <div className="proposal-review-empty">
          <FaSyncAlt className="spin" />
          <span>正在读取变更队列</span>
        </div>
      ) : visibleProposals.length === 0 ? (
        <div className="proposal-review-empty">
          <FaCheck />
          <span>{emptyText}</span>
        </div>
      ) : (
        <div className="proposal-review-stack">
          {visibleProposals.map((proposal) => {
            const selectedIds = selectedByProposal[proposal.id] || [];
            const selectableCount = proposal.operations.filter(isSelectableOperation).length;
            const selectedCount = selectedIds.length;
            const isOpen = openByProposal[proposal.id];
            const hasConflict = proposal.status === 'conflicted'
              || proposal.operations.some((operation) => operation.status === 'conflicted');

            return (
              <article key={proposal.id} className={`proposal-card ${hasConflict ? 'has-conflict' : ''}`}>
                <button type="button" className="proposal-card-summary" onClick={() => toggleOpen(proposal.id)} aria-expanded={isOpen}>
                  <span className="proposal-card-toggle"><FaChevronDown /></span>
                  <span className="proposal-card-main">
                    <span className="proposal-card-title-row">
                      <strong>{proposal.title}</strong>
                      <span className={`proposal-status ${proposal.status}`}>{STATUS_LABELS[proposal.status] || proposal.status}</span>
                    </span>
                    <span className="proposal-card-meta">
                      <span>{selectedCount}/{selectableCount} 项</span>
                      {proposal.confidence !== null && proposal.confidence !== undefined && (
                        <span>{Math.round(proposal.confidence * 100)}% 置信</span>
                      )}
                      {proposal.chapter_id && <span>章节 #{proposal.chapter_id}</span>}
                    </span>
                  </span>
                </button>

                {isOpen && (
                  <div className="proposal-card-body">
                    {proposal.summary && <p className="proposal-summary-text">{proposal.summary}</p>}
                    {proposal.evidence && <p className="proposal-evidence-text">“{truncate(proposal.evidence, 132)}”</p>}

                    <div className="proposal-operation-toolbar">
                      <button type="button" onClick={() => toggleAll(proposal)} disabled={selectableCount === 0}>
                        {selectedCount === selectableCount ? '取消全选' : '全选'}
                      </button>
                    </div>

                    <div className="proposal-operation-list">
                      {proposal.operations.map((operation) => {
                        const OperationIcon = getOperationIcon(operation.operation_type);
                        const selectable = isSelectableOperation(operation);
                        const checked = selectedIds.includes(operation.id);

                        return (
                          <label key={operation.id} className={`proposal-operation ${operation.status}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!selectable}
                              onChange={() => toggleOperation(proposal.id, operation.id)}
                            />
                            <span className="proposal-operation-icon"><OperationIcon /></span>
                            <span className="proposal-operation-copy">
                              <span>
                                <strong>{OPERATION_LABELS[operation.operation_type] || operation.operation_type}</strong>
                                {describeOperation(proposal, operation, entityNameResolver)}
                              </span>
                              {operation.conflict_reason && (
                                <em><FaExclamationTriangle /> {operation.conflict_reason}</em>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="proposal-card-actions">
                      <button
                        type="button"
                        className="proposal-review-button"
                        onClick={() => onReject?.(proposal)}
                        disabled={!onReject}
                      >
                        <FaTimes />
                        拒绝
                      </button>
                      <button
                        type="button"
                        className="proposal-review-button primary"
                        onClick={() => onAccept?.(proposal, selectedIds)}
                        disabled={!onAccept || selectedCount === 0}
                      >
                        <FaCheck />
                        应用所选
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default ProposalReviewList;
