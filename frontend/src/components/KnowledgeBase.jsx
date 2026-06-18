import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FaBookOpen,
  FaBrain,
  FaBuilding,
  FaCheck,
  FaExclamationTriangle,
  FaGlobe,
  FaLayerGroup,
  FaLightbulb,
  FaMapMarkedAlt,
  FaPenNib,
  FaRobot,
  FaSyncAlt,
  FaUsers,
} from 'react-icons/fa';
import { aiService } from '../services/aiService';
import {
  acceptChangeProposal,
  getChangeProposals,
  getEntityRelationships,
  getEntityStateEvents,
  getProjectContext,
  rejectChangeProposal,
} from '../services/knowledgeService';
import { useNotification } from './NotificationManager';
import KnowledgeGraphView from './knowledge/KnowledgeGraphView';
import ProposalReviewList from './knowledge/ProposalReviewList';
import './KnowledgeBase.css';

const EMPTY_CONTEXT = {
  projectName: '未命名项目',
  projectDescription: '',
  characters: [],
  worldviews: [],
  locations: [],
  organizations: [],
  chapters: [],
};

const KNOWLEDGE_SECTIONS = [
  {
    id: 'characters',
    label: '角色',
    noun: '角色',
    Icon: FaUsers,
    description: '人物档案、性格、背景与外貌线索',
    empty: '还没有角色档案',
  },
  {
    id: 'worldviews',
    label: '世界观',
    noun: '设定',
    Icon: FaGlobe,
    description: '世界规则、魔法体系与核心设定',
    empty: '还没有世界观设定',
  },
  {
    id: 'locations',
    label: '地点',
    noun: '地点',
    Icon: FaMapMarkedAlt,
    description: '地点、地理结构与场景空间',
    empty: '还没有地点资料',
  },
  {
    id: 'organizations',
    label: '组织',
    noun: '组织',
    Icon: FaBuilding,
    description: '势力、机构、目的与影响力',
    empty: '还没有组织资料',
  },
  {
    id: 'chapters',
    label: '章节上下文',
    noun: '章节',
    Icon: FaBookOpen,
    description: '已写章节、摘要与 AI 可引用前文',
    empty: '还没有章节上下文',
  },
];

const toArray = (value) => (Array.isArray(value) ? value : []);

const truncate = (value, length = 120) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > length ? `${text.slice(0, length)}...` : text;
};

const compactJoin = (...parts) => parts.filter(Boolean).join(' / ');

const normalizeContext = (payload) => {
  const raw = payload?.context || payload || {};

  return {
    projectName: raw.project_name || EMPTY_CONTEXT.projectName,
    projectDescription: raw.project_description || '',
    characters: toArray(raw.characters),
    worldviews: toArray(raw.worldviews),
    locations: toArray(raw.locations),
    organizations: toArray(raw.organizations),
    chapters: toArray(raw.previous_chapters || raw.chapters),
  };
};

const getSectionItems = (context, sectionId) => {
  if (sectionId === 'chapters') return context.chapters;
  return context[sectionId] || [];
};

const getItemTitle = (sectionId, item, index) => {
  if (sectionId === 'chapters') {
    return item.title || `第 ${item.number || index + 1} 章`;
  }
  return item.name || `未命名${index + 1}`;
};

const getItemSummary = (sectionId, item) => {
  if (sectionId === 'characters') {
    return truncate(item.description || item.personality || item.background || item.appearance || '暂无角色摘要', 150);
  }
  if (sectionId === 'worldviews') {
    return truncate(item.description || item.rules || item.magic_system || '暂无世界观摘要', 150);
  }
  if (sectionId === 'locations') {
    return truncate(item.description || item.geography || '暂无地点摘要', 150);
  }
  if (sectionId === 'organizations') {
    return truncate(item.description || item.purpose || '暂无组织摘要', 150);
  }
  return truncate(item.summary || '暂无章节摘要', 170);
};

const getItemMeta = (sectionId, item) => {
  if (sectionId === 'characters') {
    return [
      item.personality ? '性格已录入' : null,
      item.background ? '背景已录入' : null,
      item.appearance ? '外貌已录入' : null,
    ].filter(Boolean);
  }
  if (sectionId === 'worldviews') {
    return [
      item.rules ? '规则' : null,
      item.magic_system ? '体系' : null,
    ].filter(Boolean);
  }
  if (sectionId === 'locations') {
    return [item.geography ? '地理' : null].filter(Boolean);
  }
  if (sectionId === 'organizations') {
    return [item.purpose ? '目的' : null].filter(Boolean);
  }
  return [
    item.number ? `第 ${item.number} 章` : null,
    Number.isFinite(item.word_count) ? `${item.word_count} 字` : null,
  ].filter(Boolean);
};

const normalizeAiText = (result) => {
  if (!result) return '';
  if (typeof result === 'string') return result;
  return result.ideas || result.content || result.message || JSON.stringify(result, null, 2);
};

const buildInsightPrompt = (context, kind) => {
  const compactContext = {
    project_name: context.projectName,
    project_description: context.projectDescription,
    counts: {
      characters: context.characters.length,
      worldviews: context.worldviews.length,
      locations: context.locations.length,
      organizations: context.organizations.length,
      chapters: context.chapters.length,
    },
    samples: {
      characters: context.characters.slice(0, 6).map((item) => ({
        name: item.name,
        description: item.description,
        personality: item.personality,
      })),
      worldviews: context.worldviews.slice(0, 4),
      locations: context.locations.slice(0, 5),
      organizations: context.organizations.slice(0, 5),
      chapters: context.chapters.slice(-5),
    },
  };

  if (kind === 'diagnosis') {
    return [
      '你是一个 AI 小说项目知识库架构顾问。请基于下面的项目上下文做一次“AI 可用性诊断”。',
      '请直接给出：1）当前知识库强项；2）最影响后续写作/AI 对话的缺口；3）下一步最值得补的 3 个资料项；4）如果马上继续写作，AI 应优先记住的上下文。',
      '输出使用中文，结构清晰，避免空泛建议。',
      '',
      JSON.stringify(compactContext, null, 2),
    ].join('\n');
  }

  return [
    '你是一个专业小说策划与 AI 写作搭档。请基于下面的项目知识库，生成可直接用于推进小说的创作洞察。',
    '请给出：1）可延展的冲突线；2）角色/世界观/地点之间可建立的连接；3）下一章或下一场戏的 3 个方向；4）一个大胆但合理的设定增强建议。',
    '输出使用中文，允许提出有创意的方案，不要过度保守。',
    '',
    JSON.stringify(compactContext, null, 2),
  ].join('\n');
};

const KnowledgeBase = ({ projectId }) => {
  const [contextData, setContextData] = useState(EMPTY_CONTEXT);
  const [selectedSectionId, setSelectedSectionId] = useState('characters');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiMode, setAiMode] = useState('');
  const [changeProposals, setChangeProposals] = useState([]);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [relationships, setRelationships] = useState([]);
  const [stateEvents, setStateEvents] = useState([]);
  const { addNotification } = useNotification();

  const loadContext = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setLoadError('');
    try {
      const payload = await getProjectContext(projectId, 'full');
      setContextData(normalizeContext(payload));
    } catch (error) {
      setLoadError(error.message || '知识库上下文加载失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const loadKnowledgeGraph = useCallback(async () => {
    if (!projectId) return;

    setProposalLoading(true);
    try {
      const [pending, conflicted, relationshipRows, stateRows] = await Promise.all([
        getChangeProposals(projectId, { status: 'pending' }),
        getChangeProposals(projectId, { status: 'conflicted' }),
        getEntityRelationships(projectId),
        getEntityStateEvents(projectId),
      ]);
      setChangeProposals([...(conflicted || []), ...(pending || [])]);
      setRelationships(relationshipRows || []);
      setStateEvents(stateRows || []);
    } catch (error) {
      addNotification({
        message: `知识变更队列加载失败: ${error.message}`,
        type: 'error',
      });
    } finally {
      setProposalLoading(false);
    }
  }, [projectId, addNotification]);

  useEffect(() => {
    loadKnowledgeGraph();
  }, [loadKnowledgeGraph]);

  const metrics = useMemo(() => {
    const checks = [
      {
        id: 'description',
        label: '项目简介',
        ready: Boolean(contextData.projectDescription),
        detail: contextData.projectDescription ? '可用于提示词背景' : '缺少项目背景，会削弱 AI 对作品基调的判断',
      },
      ...KNOWLEDGE_SECTIONS.map((section) => {
        const count = getSectionItems(contextData, section.id).length;
        return {
          id: section.id,
          label: section.label,
          ready: count > 0,
          detail: count > 0 ? `${count} 个${section.noun}` : section.empty,
        };
      }),
    ];
    const readyCount = checks.filter((check) => check.ready).length;
    const score = Math.round((readyCount / checks.length) * 100);
    const totalAssets = KNOWLEDGE_SECTIONS.reduce(
      (sum, section) => sum + getSectionItems(contextData, section.id).length,
      0,
    );

    return { checks, readyCount, score, totalAssets };
  }, [contextData]);

  const selectedSection = KNOWLEDGE_SECTIONS.find((section) => section.id === selectedSectionId) || KNOWLEDGE_SECTIONS[0];
  const selectedItems = getSectionItems(contextData, selectedSection.id);
  const latestChapter = contextData.chapters[contextData.chapters.length - 1];
  const gapChecks = metrics.checks.filter((check) => !check.ready);

  const entityNameResolver = useMemo(() => {
    const lookup = new Map();
    [
      ['character', contextData.characters],
      ['worldview', contextData.worldviews],
      ['location', contextData.locations],
      ['organization', contextData.organizations],
    ].forEach(([type, items]) => {
      items.forEach((item) => {
        if (item.id) lookup.set(`${type}:${item.id}`, item.name || item.title);
      });
    });
    return (type, id) => lookup.get(`${type}:${id}`);
  }, [contextData]);

  const handleAiInsight = async (kind) => {
    if (!projectId || aiAnalyzing) return;

    setAiMode(kind);
    setAiAnalyzing(true);
    try {
      const result = await aiService.generateCreativeIdeas(
        projectId,
        buildInsightPrompt(contextData, kind),
        kind === 'diagnosis' ? 'knowledge-diagnosis' : 'knowledge-story-insight',
      );
      setAiAnalysis({
        kind,
        title: kind === 'diagnosis' ? 'AI 知识库诊断' : 'AI 创作洞察',
        text: normalizeAiText(result),
      });
      addNotification({
        message: kind === 'diagnosis' ? 'AI 诊断已生成' : 'AI 创作洞察已生成',
        type: 'success',
      });
    } catch (error) {
      addNotification({
        message: `AI 生成失败: ${error.message}`,
        type: 'error',
      });
    } finally {
      setAiAnalyzing(false);
      setAiMode('');
    }
  };

  const handleAcceptProposal = useCallback(async (proposal, acceptedOperationIds) => {
    try {
      await acceptChangeProposal(proposal.id, acceptedOperationIds);
      addNotification({
        message: '知识变更已应用',
        type: 'success',
      });
      await Promise.all([loadContext(), loadKnowledgeGraph()]);
    } catch (error) {
      addNotification({
        message: `应用失败: ${error.message}`,
        type: 'error',
      });
      await loadKnowledgeGraph();
    }
  }, [addNotification, loadContext, loadKnowledgeGraph]);

  const handleRejectProposal = useCallback(async (proposal) => {
    try {
      await rejectChangeProposal(proposal.id, '用户在知识库总览拒绝');
      addNotification({
        message: '知识变更已拒绝',
        type: 'success',
      });
      await loadKnowledgeGraph();
    } catch (error) {
      addNotification({
        message: `拒绝失败: ${error.message}`,
        type: 'error',
      });
    }
  }, [addNotification, loadKnowledgeGraph]);

  const ReadinessIcon = metrics.score >= 70 ? FaCheck : FaExclamationTriangle;

  return (
    <div className="knowledge-base knowledge-console">
      <header className="knowledge-console-header">
        <div className="knowledge-title-block">
          <span className="knowledge-kicker">Knowledge Console</span>
          <h2>知识库总览</h2>
          <p>查看 AI 当前能调用的小说上下文，快速发现角色、设定、地点、组织和章节之间的缺口。</p>
        </div>
        <div className="knowledge-header-actions" aria-label="知识库操作">
          <button type="button" className="knowledge-action-btn ghost" onClick={loadContext} disabled={loading}>
            <FaSyncAlt className={loading ? 'spin' : ''} />
            刷新上下文
          </button>
          <button
            type="button"
            className="knowledge-action-btn primary"
            onClick={() => handleAiInsight('diagnosis')}
            disabled={aiAnalyzing || loading || !projectId}
          >
            {aiAnalyzing && aiMode === 'diagnosis' ? <FaSyncAlt className="spin" /> : <FaBrain />}
            AI 诊断
          </button>
          <button
            type="button"
            className="knowledge-action-btn primary"
            onClick={() => handleAiInsight('insight')}
            disabled={aiAnalyzing || loading || !projectId}
          >
            {aiAnalyzing && aiMode === 'insight' ? <FaSyncAlt className="spin" /> : <FaLightbulb />}
            生成创作洞察
          </button>
        </div>
      </header>

      {loadError && (
        <div className="knowledge-alert" role="alert">
          <FaExclamationTriangle />
          <span>{loadError}</span>
        </div>
      )}

      <section className="knowledge-overview-grid" aria-label="知识库概览">
        <article className="knowledge-readiness-card">
          <div className="knowledge-score-row">
            <div className="knowledge-score">
              <strong>{metrics.score}</strong>
              <span>%</span>
            </div>
            <div>
              <div className="knowledge-card-label">
                <ReadinessIcon />
                上下文准备度
              </div>
              <p>{metrics.readyCount} / {metrics.checks.length} 项可供 AI 稳定引用</p>
            </div>
          </div>
          <progress className="knowledge-score-progress" value={metrics.score} max="100" aria-label="上下文准备度" />
          <div className="knowledge-check-list">
            {metrics.checks.map((check) => (
              <div key={check.id} className={`knowledge-check ${check.ready ? 'ready' : 'missing'}`}>
                {check.ready ? <FaCheck /> : <FaExclamationTriangle />}
                <span>{check.label}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="knowledge-context-brief">
          <div className="knowledge-card-label">
            <FaLayerGroup />
            AI 已知项目
          </div>
          <h3>{contextData.projectName}</h3>
          <p>{contextData.projectDescription || '尚未填写项目简介。建议补充作品类型、核心冲突、主角目标和世界规则。'}</p>
          <div className="knowledge-brief-meta">
            <span>{metrics.totalAssets} 条资料</span>
            <span>{relationships.length} 条关系</span>
            <span>{stateEvents.length} 条状态</span>
            <span>{contextData.chapters.length} 章上下文</span>
            {latestChapter && <span>最新：{latestChapter.title || `第 ${latestChapter.number} 章`}</span>}
          </div>
        </article>

        <article className="knowledge-ai-card">
          <div className="knowledge-card-label">
            <FaRobot />
            AI 工作入口
          </div>
          <h3>让模型检查这套记忆</h3>
          <p>不会自动消耗 token。点击后直接使用你的模型配置，生成诊断或创作建议。</p>
          <div className="knowledge-ai-mini-actions">
            <button type="button" onClick={() => handleAiInsight('diagnosis')} disabled={aiAnalyzing || loading}>
              诊断缺口
            </button>
            <button type="button" onClick={() => handleAiInsight('insight')} disabled={aiAnalyzing || loading}>
              推进创作
            </button>
          </div>
        </article>
      </section>

      <section className="knowledge-section-strip" aria-label="知识库分类">
        {KNOWLEDGE_SECTIONS.map((section) => {
          const count = getSectionItems(contextData, section.id).length;
          const Icon = section.Icon;
          const active = selectedSection.id === section.id;
          const firstItem = getSectionItems(contextData, section.id)[0];

          return (
            <button
              type="button"
              key={section.id}
              className={`knowledge-section-card ${active ? 'active' : ''}`}
              onClick={() => setSelectedSectionId(section.id)}
              aria-pressed={active}
            >
              <span className="knowledge-section-icon"><Icon /></span>
              <span className="knowledge-section-main">
                <span className="knowledge-section-name">{section.label}</span>
                <span className="knowledge-section-desc">{section.description}</span>
                <span className="knowledge-section-preview">
                  {firstItem ? getItemTitle(section.id, firstItem, 0) : section.empty}
                </span>
              </span>
              <strong>{count}</strong>
            </button>
          );
        })}
      </section>

      <KnowledgeGraphView
        projectId={projectId}
        contextData={contextData}
        relationships={relationships}
        loading={loading || proposalLoading}
      />

      <main className="knowledge-workspace">
        <section className="knowledge-entity-panel">
          <div className="knowledge-panel-header">
            <div>
              <span className="knowledge-kicker">{selectedSection.label}</span>
              <h3>{selectedSection.label}上下文</h3>
            </div>
            <span className="knowledge-count-pill">{selectedItems.length} 个{selectedSection.noun}</span>
          </div>

          {loading ? (
            <div className="knowledge-loading">
              <FaSyncAlt className="spin" />
              <span>正在读取项目上下文...</span>
            </div>
          ) : selectedItems.length > 0 ? (
            <div className="knowledge-entity-list">
              {selectedItems.slice(0, 12).map((item, index) => {
                const Icon = selectedSection.Icon;
                const meta = getItemMeta(selectedSection.id, item);

                return (
                  <article key={`${selectedSection.id}-${getItemTitle(selectedSection.id, item, index)}-${index}`} className="knowledge-entity-row">
                    <div className="knowledge-entity-icon"><Icon /></div>
                    <div className="knowledge-entity-body">
                      <div className="knowledge-entity-title-row">
                        <h4>{getItemTitle(selectedSection.id, item, index)}</h4>
                        {selectedSection.id === 'chapters' && item.word_count > 0 && (
                          <span>{item.word_count} 字</span>
                        )}
                      </div>
                      <p>{getItemSummary(selectedSection.id, item)}</p>
                      {meta.length > 0 && (
                        <div className="knowledge-entity-tags">
                          {meta.map((tag) => <span key={tag}>{tag}</span>)}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
              {selectedItems.length > 12 && (
                <div className="knowledge-more-row">还有 {selectedItems.length - 12} 条资料已进入 AI 上下文</div>
              )}
            </div>
          ) : (
            <div className="knowledge-empty-state">
              <selectedSection.Icon />
              <h4>{selectedSection.empty}</h4>
              <p>这类资料为空时，AI 对相关情节的判断会更依赖章节正文。建议先补 1-3 条核心资料。</p>
            </div>
          )}
        </section>

        <aside className="knowledge-side-rail">
          <ProposalReviewList
            title="变更提案队列"
            subtitle={`${changeProposals.length} 个待审事件`}
            proposals={changeProposals}
            loading={proposalLoading}
            onRefresh={loadKnowledgeGraph}
            onAccept={handleAcceptProposal}
            onReject={handleRejectProposal}
            entityNameResolver={entityNameResolver}
            emptyText="暂无待审知识变更"
          />

          {aiAnalysis && (
            <section className="knowledge-ai-result">
              <div className="knowledge-panel-header compact">
                <div>
                  <span className="knowledge-kicker">AI Result</span>
                  <h3>{aiAnalysis.title}</h3>
                </div>
                <button type="button" className="knowledge-icon-btn" onClick={() => setAiAnalysis(null)} aria-label="关闭 AI 结果">
                  ×
                </button>
              </div>
              <div className="knowledge-ai-output">
                {aiAnalysis.text.split('\n').filter(Boolean).map((line, index) => (
                  <p key={`${line}-${index}`}>{line}</p>
                ))}
              </div>
            </section>
          )}

          <section className="knowledge-gap-panel">
            <div className="knowledge-card-label">
              <FaExclamationTriangle />
              待补强
            </div>
            {gapChecks.length > 0 ? (
              <ul>
                {gapChecks.slice(0, 5).map((gap) => (
                  <li key={gap.id}>
                    <strong>{gap.label}</strong>
                    <span>{gap.detail}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>核心上下文都已具备。下一步可以让 AI 做一致性诊断或生成冲突线。</p>
            )}
          </section>

          <section className="knowledge-memory-panel">
            <div className="knowledge-card-label">
              <FaPenNib />
              写作记忆摘要
            </div>
            <dl>
              <div>
                <dt>角色焦点</dt>
                <dd>{contextData.characters.slice(0, 3).map((item) => item.name).filter(Boolean).join('、') || '待建立'}</dd>
              </div>
              <div>
                <dt>设定焦点</dt>
                <dd>{contextData.worldviews.slice(0, 2).map((item) => item.name).filter(Boolean).join('、') || '待建立'}</dd>
              </div>
              <div>
                <dt>空间焦点</dt>
                <dd>{compactJoin(
                  contextData.locations[0]?.name,
                  contextData.organizations[0]?.name,
                ) || '待建立'}</dd>
              </div>
              <div>
                <dt>最近章节</dt>
                <dd>{latestChapter ? (latestChapter.title || `第 ${latestChapter.number} 章`) : '暂无章节'}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </main>
    </div>
  );
};

export default KnowledgeBase;
