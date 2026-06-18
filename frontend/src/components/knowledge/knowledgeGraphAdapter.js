const ENTITY_CONFIG = {
  character: {
    label: '角色',
    section: 'characters',
    summaryFields: ['description', 'personality', 'background', 'appearance'],
  },
  organization: {
    label: '组织',
    section: 'organizations',
    summaryFields: ['description', 'purpose', 'history'],
  },
  location: {
    label: '地点',
    section: 'locations',
    summaryFields: ['description', 'geography', 'culture', 'history'],
  },
  worldview: {
    label: '世界观',
    section: 'worldviews',
    summaryFields: ['description', 'rules', 'magic_system'],
  },
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const entityKey = (type, id) => `${type}:${id}`;

const cleanText = (value) => String(value || '').trim();

const firstText = (item, fields) => {
  for (const field of fields) {
    const text = cleanText(item?.[field]);
    if (text) return text;
  }
  return '';
};

const truncate = (value, length = 96) => {
  const text = cleanText(value);
  return text.length > length ? `${text.slice(0, length)}...` : text;
};

export const buildKnowledgeGraphModel = (contextData = {}, relationships = []) => {
  const entities = new Map();

  Object.entries(ENTITY_CONFIG).forEach(([type, config]) => {
    toArray(contextData[config.section]).forEach((item) => {
      if (!item?.id) return;
      const name = cleanText(item.name || item.title) || `${config.label} ${item.id}`;
      entities.set(entityKey(type, item.id), {
        id: entityKey(type, item.id),
        entityType: type,
        entityId: item.id,
        typeLabel: config.label,
        label: name,
        summary: truncate(firstText(item, config.summaryFields), 120),
        raw: item,
      });
    });
  });

  const edges = toArray(relationships)
    .filter((relationship) => relationship?.source_type && relationship?.source_id && relationship?.target_type && relationship?.target_id)
    .map((relationship) => {
      const source = entityKey(relationship.source_type, relationship.source_id);
      const target = entityKey(relationship.target_type, relationship.target_id);
      return {
        id: `relationship:${relationship.id || `${source}:${relationship.relation_type}:${target}`}`,
        source,
        target,
        relationType: relationship.relation_type || 'related_to',
        status: relationship.status || 'active',
        description: relationship.description || '',
        evidence: relationship.evidence || '',
        confidence: relationship.confidence,
        properties: relationship.properties || {},
        raw: relationship,
      };
    })
    .filter((edge) => entities.has(edge.source) && entities.has(edge.target));

  return {
    entities,
    entityList: Array.from(entities.values()).sort((a, b) => {
      if (a.entityType !== b.entityType) return a.entityType.localeCompare(b.entityType);
      return a.label.localeCompare(b.label);
    }),
    edges,
  };
};

export const buildFocusedKnowledgeGraph = ({
  graphModel,
  focalEntityId,
  expandedEntityIds = [],
  includeHistorical = false,
  maxEdges = 90,
}) => {
  if (!graphModel?.entities?.has(focalEntityId)) {
    return { nodes: [], edges: [], firstHopEntityIds: [], truncated: false };
  }

  const expanded = new Set(expandedEntityIds);
  const visibleNodeIds = new Set([focalEntityId]);
  const visibleEdges = [];
  const seenEdgeIds = new Set();
  const firstHopEntityIds = new Set();
  const allowedEdges = graphModel.edges.filter((edge) => includeHistorical || edge.status === 'active');

  const addEdge = (edge, markFirstHop = false) => {
    if (seenEdgeIds.has(edge.id)) return;
    seenEdgeIds.add(edge.id);
    visibleEdges.push(edge);
    visibleNodeIds.add(edge.source);
    visibleNodeIds.add(edge.target);
    if (markFirstHop) {
      if (edge.source !== focalEntityId) firstHopEntityIds.add(edge.source);
      if (edge.target !== focalEntityId) firstHopEntityIds.add(edge.target);
    }
  };

  allowedEdges.forEach((edge) => {
    if (edge.source === focalEntityId || edge.target === focalEntityId) {
      addEdge(edge, true);
    }
  });

  allowedEdges.forEach((edge) => {
    if (!expanded.has(edge.source) && !expanded.has(edge.target)) return;
    if (edge.source !== focalEntityId && edge.target !== focalEntityId) {
      addEdge(edge);
    }
  });

  const truncated = visibleEdges.length > maxEdges;
  const cappedEdges = visibleEdges.slice(0, maxEdges);
  const cappedNodeIds = new Set([focalEntityId]);
  cappedEdges.forEach((edge) => {
    cappedNodeIds.add(edge.source);
    cappedNodeIds.add(edge.target);
  });

  return {
    nodes: Array.from(cappedNodeIds)
      .map((id) => graphModel.entities.get(id))
      .filter(Boolean),
    edges: cappedEdges,
    firstHopEntityIds: Array.from(firstHopEntityIds),
    truncated,
  };
};

export const toCytoscapeElements = ({ nodes, edges, focalEntityId, expandedEntityIds = [] }) => {
  const expanded = new Set(expandedEntityIds);
  return [
    ...nodes.map((node) => ({
      data: {
        id: node.id,
        label: node.label,
        entityType: node.entityType,
        entityId: node.entityId,
        typeLabel: node.typeLabel,
        summary: node.summary,
      },
      classes: [
        'knowledge-node',
        `entity-${node.entityType}`,
        node.id === focalEntityId ? 'is-focal' : '',
        expanded.has(node.id) ? 'is-expanded' : '',
      ].filter(Boolean).join(' '),
    })),
    ...edges.map((edge) => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.relationType,
        relationType: edge.relationType,
        status: edge.status,
        description: edge.description,
        evidence: edge.evidence,
        confidence: edge.confidence,
        properties: edge.properties,
      },
      classes: ['knowledge-edge', edge.status === 'active' ? 'is-active' : 'is-history'].join(' '),
    })),
  ];
};

export const getEntityTypeLabel = (type) => ENTITY_CONFIG[type]?.label || type || '实体';
