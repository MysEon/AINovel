import React, { useState, useEffect } from 'react';
import { FaBrain, FaChartLine, FaMagic, FaLightbulb, FaUsers, FaSpinner } from 'react-icons/fa';
import { aiService } from '../services/aiService';
import { useNotification } from './NotificationManager';
import './KnowledgeBase.css';

const KnowledgeBase = ({ projectId }) => {
  const [activeModule, setActiveModule] = useState('characters');
  const [knowledgeData, setKnowledgeData] = useState({});
  const [loading, setLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const { addNotification } = useNotification();

  // 四个知识库模块
  const modules = [
    {
      id: 'characters',
      name: '角色知识库',
      icon: '👥',
      description: '管理角色信息、关系图谱、对话风格',
      color: '#FF6B6B'
    },
    {
      id: 'worldviews',
      name: '世界观知识库',
      icon: '🌍',
      description: '构建世界观、魔法体系、时间线',
      color: '#4ECDC4'
    },
    {
      id: 'scenes',
      name: '场景知识库',
      icon: '🏞️',
      description: '场景管理、氛围标签、模板库',
      color: '#45B7D1'
    },
    {
      id: 'techniques',
      name: '创作技巧库',
      icon: '✍️',
      description: '写作技巧、灵感收集、案例分析',
      color: '#96CEB4'
    }
  ];

  useEffect(() => {
    if (projectId) {
      loadKnowledgeData();
    }
  }, [projectId, activeModule]);

  const loadKnowledgeData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('ainovel_token');
      if (!token) {
        throw new Error('请先登录');
      }

      const response = await fetch(`/api/knowledge/${activeModule}/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setKnowledgeData(prev => ({ ...prev, [activeModule]: data }));
      } else if (response.status === 401) {
        localStorage.removeItem('ainovel_token');
        throw new Error('登录已过期，请重新登录');
      } else {
        throw new Error('加载知识库数据失败');
      }
    } catch (error) {
      console.error('加载知识库数据失败:', error);
      addNotification({
        message: '加载知识库数据失败: ' + error.message,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const performAIAnalysis = async () => {
    if (!projectId) return;

    setAiAnalyzing(true);
    try {
      let analysisResult;
      switch (activeModule) {
        case 'characters':
          analysisResult = await aiService.analyzeCharacterRelationships(projectId);
          break;
        case 'worldviews':
          analysisResult = await aiService.checkWorldviewConsistency(projectId, '');
          break;
        case 'scenes':
          analysisResult = await aiService.generateCreativeIdeas(projectId, '分析场景知识库并提供改进建议');
          break;
        case 'techniques':
          analysisResult = await aiService.getWritingSuggestions(projectId, '', { type: 'techniques' });
          break;
        default:
          analysisResult = await aiService.analyzeKnowledgeBase(projectId, activeModule);
      }
      
      setAiAnalysis(analysisResult);
      addNotification({
        message: 'AI分析完成',
        type: 'success'
      });
    } catch (error) {
      addNotification({
        message: 'AI分析失败: ' + error.message,
        type: 'error'
      });
    } finally {
      setAiAnalyzing(false);
    }
  };

  const generateAIInsights = async () => {
    if (!projectId) return;

    setAiAnalyzing(true);
    try {
      const insights = await aiService.generateCreativeIdeas(projectId, `基于${activeModule}知识库提供创作建议`);
      setAiAnalysis(insights);
      addNotification({
        message: 'AI洞察生成完成',
        type: 'success'
      });
    } catch (error) {
      addNotification({
        message: 'AI洞察生成失败: ' + error.message,
        type: 'error'
      });
    } finally {
      setAiAnalyzing(false);
    }
  };

  const renderModuleContent = () => {
    switch (activeModule) {
      case 'characters':
        return <CharacterKnowledgeBase data={knowledgeData.characters || []} />;
      case 'worldviews':
        return <WorldviewKnowledgeBase data={knowledgeData.worldviews || []} />;
      case 'scenes':
        return <SceneKnowledgeBase data={knowledgeData.scenes || []} />;
      case 'techniques':
        return <WritingTechniqueKnowledgeBase data={knowledgeData.techniques || []} />;
      default:
        return <div>请选择一个知识库模块</div>;
    }
  };

  return (
    <div className="knowledge-base">
      <div className="knowledge-header">
        <h2>知识库</h2>
        <p>系统化管理您的创作素材和技巧</p>
        <div className="ai-actions">
          <button 
            className="ai-action-btn analysis"
            onClick={performAIAnalysis}
            disabled={aiAnalyzing || !projectId}
          >
            {aiAnalyzing ? <FaSpinner className="spinner" /> : <FaBrain />}
            {aiAnalyzing ? '分析中...' : 'AI分析'}
          </button>
          <button 
            className="ai-action-btn insights"
            onClick={generateAIInsights}
            disabled={aiAnalyzing || !projectId}
          >
            {aiAnalyzing ? <FaSpinner className="spinner" /> : <FaLightbulb />}
            {aiAnalyzing ? '生成中...' : 'AI洞察'}
          </button>
        </div>
      </div>

      <div className="knowledge-modules">
        {modules.map(module => (
          <div
            key={module.id}
            className={`module-card ${activeModule === module.id ? 'active' : ''}`}
            onClick={() => setActiveModule(module.id)}
            style={{ '--module-color': module.color }}
          >
            <div className="module-icon">{module.icon}</div>
            <div className="module-info">
              <h3>{module.name}</h3>
              <p>{module.description}</p>
            </div>
            <div className="module-indicator">{activeModule === module.id && <div className="active-indicator"></div>}</div>
          </div>
        ))}
      </div>

      <div className="knowledge-content">
        {loading ? (
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>加载中...</p>
          </div>
        ) : (
          <div className="knowledge-content-wrapper">
            {aiAnalysis && (
              <div className="ai-analysis-panel">
                <div className="ai-analysis-header">
                  <FaBrain className="ai-icon" />
                  <h3>AI分析结果</h3>
                  <button 
                    className="close-analysis"
                    onClick={() => setAiAnalysis(null)}
                  >
                    ×
                  </button>
                </div>
                <div className="ai-analysis-content">
                  {typeof aiAnalysis === 'string' ? (
                    <p>{aiAnalysis}</p>
                  ) : (
                    <div className="ai-analysis-structured">
                      {aiAnalysis.content && <p>{aiAnalysis.content}</p>}
                      {aiAnalysis.suggestions && (
                        <div className="suggestions-list">
                          <h4>建议:</h4>
                          <ul>
                            {aiAnalysis.suggestions.map((suggestion, index) => (
                              <li key={index}>{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aiAnalysis.insights && (
                        <div className="insights-list">
                          <h4>洞察:</h4>
                          <ul>
                            {aiAnalysis.insights.map((insight, index) => (
                              <li key={index}>{insight}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aiAnalysis.recommendations && (
                        <div className="recommendations-list">
                          <h4>推荐:</h4>
                          <ul>
                            {aiAnalysis.recommendations.map((recommendation, index) => (
                              <li key={index}>{recommendation}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {renderModuleContent()}
          </div>
        )}
      </div>
    </div>
  );
};

// 角色知识库总览组件
const CharacterKnowledgeBase = ({ data }) => (
  <div className="character-knowledge">
    <div className="knowledge-overview-header">
      <h3>角色知识库</h3>
      <div className="stats-badge">{data.length} 个角色</div>
    </div>
    {data.length > 0 ? (
      <div className="characters-overview">
        {data.slice(0, 6).map(character => (
          <div key={character.id} className="character-summary-card">
            <div className="character-avatar">
              <div className="avatar-icon">👤</div>
            </div>
            <div className="character-summary-info">
              <h4>{character.name}</h4>
              <p className="character-personality">{character.personality || '暂无性格描述'}</p>
              <div className="character-tags">
                <span className="tag">{character.dialogue_style || '对话风格未设置'}</span>
              </div>
            </div>
          </div>
        ))}
        {data.length > 6 && (
          <div className="view-more">
            <span>+{data.length - 6} 个更多角色</span>
          </div>
        )}
      </div>
    ) : (
      <div className="empty-state">
        <div className="empty-icon">👥</div>
        <p>暂无角色数据</p>
        <span className="empty-hint">开始创建您的第一个角色</span>
      </div>
    )}
  </div>
);

// 世界观知识库总览组件
const WorldviewKnowledgeBase = ({ data }) => (
  <div className="worldview-knowledge">
    <div className="knowledge-overview-header">
      <h3>世界观知识库</h3>
      <div className="stats-badge">{data.length} 个世界观</div>
    </div>
    {data.length > 0 ? (
      <div className="worldviews-overview">
        {data.slice(0, 4).map(worldview => (
          <div key={worldview.id} className="worldview-summary-card">
            <div className="worldview-icon">🌍</div>
            <div className="worldview-summary-info">
              <h4>{worldview.name}</h4>
              <p className="worldview-desc">{worldview.description || '暂无描述'}</p>
              <div className="worldview-features">
                {worldview.magic_system && (
                  <span className="feature-tag">魔法: {worldview.magic_system}</span>
                )}
                {worldview.technology_level && (
                  <span className="feature-tag">科技: {worldview.technology_level}</span>
                )}
              </div>
            </div>
          </div>
        ))}
        {data.length > 4 && (
          <div className="view-more">
            <span>+{data.length - 4} 个更多世界观</span>
          </div>
        )}
      </div>
    ) : (
      <div className="empty-state">
        <div className="empty-icon">🌍</div>
        <p>暂无世界观数据</p>
        <span className="empty-hint">开始构建您的世界观</span>
      </div>
    )}
  </div>
);

// 场景知识库总览组件
const SceneKnowledgeBase = ({ data }) => (
  <div className="scene-knowledge">
    <div className="knowledge-overview-header">
      <h3>场景知识库</h3>
      <div className="stats-badge">{data.length} 个场景</div>
    </div>
    {data.length > 0 ? (
      <div className="scenes-overview">
        {data.slice(0, 6).map(scene => (
          <div key={scene.id} className="scene-summary-card">
            <div className="scene-icon">🏞️</div>
            <div className="scene-summary-info">
              <h4>{scene.name}</h4>
              <p className="scene-desc">{scene.description || '暂无描述'}</p>
              <div className="scene-meta">
                <span className="usage-count">使用 {scene.usage_count || 0} 次</span>
                {scene.geography && (
                  <span className="location-tag">{scene.geography}</span>
                )}
              </div>
            </div>
          </div>
        ))}
        {data.length > 6 && (
          <div className="view-more">
            <span>+{data.length - 6} 个更多场景</span>
          </div>
        )}
      </div>
    ) : (
      <div className="empty-state">
        <div className="empty-icon">🏞️</div>
        <p>暂无场景数据</p>
        <span className="empty-hint">开始创建您的场景库</span>
      </div>
    )}
  </div>
);

// 创作技巧知识库总览组件
const WritingTechniqueKnowledgeBase = ({ data }) => (
  <div className="technique-knowledge">
    <div className="knowledge-overview-header">
      <h3>创作技巧库</h3>
      <div className="stats-badge">{data.length} 个分类</div>
    </div>
    {data.length > 0 ? (
      <div className="techniques-overview">
        {data.slice(0, 3).map(technique => (
          <div key={technique.id} className="technique-summary-card">
            <div className="technique-icon">✍️</div>
            <div className="technique-summary-info">
              <h4>{technique.name}</h4>
              <span className="technique-category-badge">{technique.category}</span>
              <div className="technique-preview">
                <p>{technique.inspiration_notes && technique.inspiration_notes.length > 0 
                  ? technique.inspiration_notes[0] 
                  : '暂无灵感记录'}</p>
              </div>
              <div className="technique-stats">
                <span className="technique-count">{technique.techniques ? technique.techniques.length : 0} 个技巧</span>
              </div>
            </div>
          </div>
        ))}
        {data.length > 3 && (
          <div className="view-more">
            <span>+{data.length - 3} 个更多分类</span>
          </div>
        )}
      </div>
    ) : (
      <div className="empty-state">
        <div className="empty-icon">✍️</div>
        <p>暂无技巧数据</p>
        <span className="empty-hint">开始收集创作技巧</span>
      </div>
    )}
  </div>
);

export default KnowledgeBase;