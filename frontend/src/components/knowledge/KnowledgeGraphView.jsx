import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import {
  FaBullseye,
  FaChevronDown,
  FaClock,
  FaExpandAlt,
  FaFilter,
  FaProjectDiagram,
  FaSearch,
  FaSyncAlt,
} from 'react-icons/fa';
import {
  buildFocusedKnowledgeGraph,
  buildKnowledgeGraphModel,
  getEntityTypeLabel,
  toCytoscapeElements,
} from './knowledgeGraphAdapter';
import { getEntityRelationships } from '../../services/knowledgeService';
import './KnowledgeGraphView.css';

const GRAPH_LAYOUT = {
  name: 'cose',
  animate: false,
  fit: true,
  padding: 36,
  nodeRepulsion: 7200,
  idealEdgeLength: 116,
  edgeElasticity: 110,
  numIter: 160,
};

const GRAPH_STYLE = [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      width: 44,
      height: 44,
      'background-color': '#6b7280',
      'border-width': 2,
      'border-color': '#ffffff',
      color: '#111827',
      'font-size': 11,
      'font-weight': 700,
      'text-valign': 'bottom',
      'text-halign': 'center',
      'text-margin-y': 8,
      'text-wrap': 'wrap',
      'text-max-width': 92,
      'overlay-opacity': 0,
      'transition-duration': '0.18s',
    },
  },
  {
    selector: '.entity-character',
    style: { 'background-color': '#2563eb' },
  },
  {
    selector: '.entity-organization',
    style: { 'background-color': '#d97706' },
  },
  {
    selector: '.entity-location',
    style: { 'background-color': '#059669' },
  },
  {
    selector: '.entity-worldview',
    style: { 'background-color': '#7c3aed' },
  },
  {
    selector: 'node.is-focal',
    style: {
      width: 58,
      height: 58,
      'border-width': 4,
      'border-color': '#111827',
      'font-size': 12,
    },
  },
  {
    selector: 'node.is-expanded',
    style: {
      'border-width': 4,
      'border-color': '#f59e0b',
    },
  },
  {
    selector: 'node:selected',
    style: {
      'border-width': 5,
      'border-color': '#0d0d0d',
    },
  },
  {
    selector: 'edge',
    style: {
      label: 'data(label)',
      width: 2,
      'curve-style': 'bezier',
      'target-arrow-shape': 'triangle',
      'target-arrow-color': '#9ca3af',
      'line-color': '#9ca3af',
      color: '#374151',
      'font-size': 10,
      'font-weight': 700,
      'text-background-color': '#ffffff',
      'text-background-opacity': 0.86,
      'text-background-padding': 3,
      'text-rotation': 'autorotate',
      'overlay-opacity': 0,
      'transition-duration': '0.18s',
    },
  },
  {
    selector: 'edge.is-active',
    style: {
      width: 2.5,
      'line-color': '#4b5563',
      'target-arrow-color': '#4b5563',
    },
  },
  {
    selector: 'edge.is-history',
    style: {
      width: 1.5,
      'line-color': '#c4c4c4',
      'target-arrow-color': '#c4c4c4',
      'line-style': 'dashed',
      color: '#777777',
      opacity: 0.74,
    },
  },
  {
    selector: 'edge:selected',
    style: {
      width: 4,
      'line-color': '#0d0d0d',
      'target-arrow-color': '#0d0d0d',
      color: '#0d0d0d',
    },
  },
];

const formatConfidence = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '';
  return `${Math.round(Number(value) * 100)}%`;
};

const normalizeSearch = (value) => String(value || '').trim().toLowerCase();

const DetailPanel = ({ selection, focalEntity, expanded, onToggleExpand }) => {
  if (selection?.kind === 'edge') {
    const edge = selection.data;
    const confidence = formatConfidence(edge.confidence);
    return (
      <aside className="knowledge-graph-detail" aria-label="关系详情">
        <div className="knowledge-graph-detail-kicker">关系</div>
        <h4>{edge.relationType}</h4>
        <div className={`knowledge-graph-status ${edge.status === 'active' ? 'is-active' : 'is-history'}`}>
          {edge.status === 'active' ? '当前关系' : '历史关系'}
        </div>
        {confidence && (
          <dl>
            <div>
              <dt>置信度</dt>
              <dd>{confidence}</dd>
            </div>
          </dl>
        )}
        {edge.description && <p>{edge.description}</p>}
        {edge.evidence && <blockquote>{edge.evidence}</blockquote>}
      </aside>
    );
  }

  const node = selection?.kind === 'node' ? selection.data : focalEntity;
  if (!node) {
    return (
      <aside className="knowledge-graph-detail empty" aria-label="图谱详情">
        <FaBullseye />
        <h4>选择一个节点</h4>
        <p>点击图中的实体或关系，查看 AI 当前会引用的关系语义。</p>
      </aside>
    );
  }

  const canExpand = node.id !== focalEntity?.id;
  const isExpanded = expanded.has(node.id);

  return (
    <aside className="knowledge-graph-detail" aria-label="实体详情">
      <div className="knowledge-graph-detail-kicker">{getEntityTypeLabel(node.entityType)}</div>
      <h4>{node.label}</h4>
      {node.summary && <p>{node.summary}</p>}
      <dl>
        <div>
          <dt>实体 ID</dt>
          <dd>{node.entityId}</dd>
        </div>
        <div>
          <dt>类型</dt>
          <dd>{node.typeLabel}</dd>
        </div>
      </dl>
      {canExpand && (
        <button type="button" className="knowledge-graph-secondary-btn" onClick={() => onToggleExpand(node.id)}>
          <FaExpandAlt />
          {isExpanded ? '收起二跳关系' : '展开二跳关系'}
        </button>
      )}
    </aside>
  );
};

const KnowledgeGraphView = ({ projectId = null, contextData = {}, relationships = null, loading = false }) => {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [search, setSearch] = useState('');
  const [focalEntityId, setFocalEntityId] = useState('');
  const [includeHistorical, setIncludeHistorical] = useState(false);
  const [expandedEntityIds, setExpandedEntityIds] = useState(() => new Set());
  const [selection, setSelection] = useState(null);
  const [loadedRelationships, setLoadedRelationships] = useState([]);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [relationshipError, setRelationshipError] = useState('');

  const relationshipRows = Array.isArray(relationships) ? relationships : loadedRelationships;
  const graphLoading = loading || relationshipLoading;

  const loadRelationships = useCallback(async () => {
    if (!projectId || Array.isArray(relationships)) return;
    setRelationshipLoading(true);
    setRelationshipError('');
    try {
      const rows = await getEntityRelationships(projectId);
      setLoadedRelationships(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setRelationshipError(error.message || '关系数据加载失败');
      setLoadedRelationships([]);
    } finally {
      setRelationshipLoading(false);
    }
  }, [projectId, relationships]);

  useEffect(() => {
    loadRelationships();
  }, [loadRelationships]);

  const graphModel = useMemo(
    () => buildKnowledgeGraphModel(contextData, relationshipRows),
    [contextData, relationshipRows],
  );

  useEffect(() => {
    if (focalEntityId && graphModel.entities.has(focalEntityId)) return;
    setFocalEntityId(graphModel.entityList[0]?.id || '');
    setExpandedEntityIds(new Set());
    setSelection(null);
  }, [focalEntityId, graphModel]);

  const focusedGraph = useMemo(
    () => buildFocusedKnowledgeGraph({
      graphModel,
      focalEntityId,
      expandedEntityIds: Array.from(expandedEntityIds),
      includeHistorical,
    }),
    [expandedEntityIds, focalEntityId, graphModel, includeHistorical],
  );

  const elements = useMemo(
    () => toCytoscapeElements({
      nodes: focusedGraph.nodes,
      edges: focusedGraph.edges,
      focalEntityId,
      expandedEntityIds: Array.from(expandedEntityIds),
    }),
    [expandedEntityIds, focalEntityId, focusedGraph],
  );

  const focalEntity = graphModel.entities.get(focalEntityId);
  const filteredEntities = useMemo(() => {
    const normalized = normalizeSearch(search);
    if (!normalized) return graphModel.entityList.slice(0, 80);
    return graphModel.entityList.filter((entity) => (
      entity.label.toLowerCase().includes(normalized)
      || entity.typeLabel.toLowerCase().includes(normalized)
      || entity.summary.toLowerCase().includes(normalized)
    )).slice(0, 80);
  }, [graphModel.entityList, search]);

  useEffect(() => {
    if (!containerRef.current || elements.length === 0) {
      cyRef.current?.destroy();
      cyRef.current = null;
      return undefined;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: GRAPH_STYLE,
      layout: GRAPH_LAYOUT,
      minZoom: 0.35,
      maxZoom: 2.2,
      wheelSensitivity: 0.16,
    });

    cyRef.current = cy;
    cy.on('tap', 'node', (event) => {
      setSelection({ kind: 'node', data: event.target.data() });
    });
    cy.on('tap', 'edge', (event) => {
      setSelection({ kind: 'edge', data: event.target.data() });
    });
    cy.on('tap', (event) => {
      if (event.target === cy) setSelection(null);
    });

    return () => {
      cy.destroy();
      if (cyRef.current === cy) cyRef.current = null;
    };
  }, [elements]);

  const handleSelectFocal = (event) => {
    setFocalEntityId(event.target.value);
    setExpandedEntityIds(new Set());
    setSelection(null);
  };

  const handleToggleExpand = (entityId) => {
    setExpandedEntityIds((current) => {
      const next = new Set(current);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
    setSelection(null);
  };

  const handleReset = () => {
    setExpandedEntityIds(new Set());
    setSelection(null);
    cyRef.current?.layout(GRAPH_LAYOUT).run();
    cyRef.current?.fit(undefined, 36);
  };

  const hasGraph = focusedGraph.nodes.length > 0;

  return (
    <section className="knowledge-graph-panel" aria-label="可视化知识图谱">
      <header className="knowledge-graph-header">
        <div>
          <span className="knowledge-kicker">
            <FaProjectDiagram />
            Knowledge Graph
          </span>
          <h3>实体关系图谱</h3>
          <p>围绕一个实体查看 AI 当前会引用的角色、组织、地点和世界观关系。</p>
        </div>
        <div className="knowledge-graph-stats" aria-label="图谱统计">
          <span>{graphModel.entityList.length} 实体</span>
          <span>{relationshipRows.length} 关系</span>
          <span>{focusedGraph.nodes.length} 可见节点</span>
          <span>{focusedGraph.edges.length} 可见关系</span>
        </div>
      </header>

      <div className="knowledge-graph-controls" aria-label="图谱控制">
        <label className="knowledge-graph-search">
          <FaSearch />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索焦点实体"
          />
        </label>
        <label className="knowledge-graph-select">
          <FaBullseye />
          <select value={focalEntityId} onChange={handleSelectFocal}>
            {filteredEntities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.label} · {entity.typeLabel}
              </option>
            ))}
          </select>
          <FaChevronDown />
        </label>
        <label className="knowledge-graph-toggle">
          <input
            type="checkbox"
            checked={includeHistorical}
            onChange={(event) => {
              setIncludeHistorical(event.target.checked);
              setSelection(null);
            }}
          />
          <FaClock />
          显示历史关系
        </label>
        <button type="button" className="knowledge-graph-reset" onClick={handleReset}>
          <FaSyncAlt />
          重置布局
        </button>
      </div>

      {relationshipError && (
        <div className="knowledge-graph-alert" role="alert">
          {relationshipError}
        </div>
      )}

      <div className="knowledge-graph-body">
        <div className="knowledge-graph-canvas-wrap">
          {graphLoading ? (
            <div className="knowledge-graph-empty">
              <FaSyncAlt className="spin" />
              <span>正在读取图谱数据...</span>
            </div>
          ) : hasGraph ? (
            <div ref={containerRef} className="knowledge-graph-canvas" aria-label="实体关系图谱画布" />
          ) : (
            <div className="knowledge-graph-empty">
              <FaFilter />
              <span>还没有可展示的实体关系。先写章节或接受知识变更后，这里会出现局部图谱。</span>
            </div>
          )}
          {focusedGraph.truncated && (
            <div className="knowledge-graph-warning">
              当前局部关系过多，已限制显示前 90 条关系。
            </div>
          )}
        </div>
        <DetailPanel
          selection={selection}
          focalEntity={focalEntity}
          expanded={expandedEntityIds}
          onToggleExpand={handleToggleExpand}
        />
      </div>
    </section>
  );
};

export default KnowledgeGraphView;
