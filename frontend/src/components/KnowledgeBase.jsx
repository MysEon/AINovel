import React, { useState, useEffect } from 'react';
import { FaBrain, FaChartLine, FaMagic, FaLightbulb, FaUsers, FaSpinner } from 'react-icons/fa';
import { aiService } from '../services/aiService';
import { useNotification } from '../NotificationManager';
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

// 角色知识库组件
const CharacterKnowledgeBase = ({ data }) => (
  <div className="character-knowledge">
    <div className="knowledge-section-header">
      <h3>角色知识库</h3>
      <button className="add-button">+ 添加角色</button>
    </div>
    <div className="characters-grid">
      {data.map(character => (
        <div key={character.id} className="character-card">
          <div className="character-header">
            <h4>{character.name}</h4>
            <div className="character-actions">
              <button className="edit-btn">编辑</button>
              <button className="delete-btn">删除</button>
            </div>
          </div>
          <div className="character-info">
            <p><strong>性格:</strong> {character.personality}</p>
            <p><strong>背景:</strong> {character.background}</p>
            <p><strong>外貌:</strong> {character.appearance}</p>
            <p><strong>对话风格:</strong> {character.dialogue_style || '未设置'}</p>
          </div>
          <div className="character-relations">
            <h5>角色关系</h5>
            <div className="relations-list">
              {character.relations && character.relations.length > 0 ? (
                character.relations.map((relation, index) => (
                  <div key={index} className="relation-item">
                    <span className="relation-type">{relation.relation_type}</span>
                    <span className="relation-desc">{relation.description}</span>
                  </div>
                ))
              ) : (
                <p className="no-relations">暂无关系记录</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// 世界观知识库组件
const WorldviewKnowledgeBase = ({ data }) => (
  <div className="worldview-knowledge">
    <div className="knowledge-section-header">
      <h3>世界观知识库</h3>
      <button className="add-button">+ 添加世界观</button>
    </div>
    <div className="worldviews-grid">
      {data.map(worldview => (
        <div key={worldview.id} className="worldview-card">
          <div className="worldview-header">
            <h4>{worldview.name}</h4>
            <div className="worldview-actions">
              <button className="edit-btn">编辑</button>
              <button className="delete-btn">删除</button>
            </div>
          </div>
          <div className="worldview-info">
            <p><strong>描述:</strong> {worldview.description}</p>
            <p><strong>魔法体系:</strong> {worldview.magic_system || '未设置'}</p>
            <p><strong>科技水平:</strong> {worldview.technology || '未设置'}</p>
          </div>
          <div className="worldview-rules">
            <h5>世界规则</h5>
            <div className="rules-list">
              {worldview.rules && worldview.rules.length > 0 ? (
                worldview.rules.map((rule, index) => (
                  <div key={index} className="rule-item">
                    <span className="rule-name">{rule.rule_name}</span>
                    <span className="rule-desc">{rule.rule_description}</span>
                  </div>
                ))
              ) : (
                <p className="no-rules">暂无规则记录</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// 场景知识库组件
const SceneKnowledgeBase = ({ data }) => (
  <div className="scene-knowledge">
    <div className="knowledge-section-header">
      <h3>场景知识库</h3>
      <button className="add-button">+ 添加场景</button>
    </div>
    <div className="scenes-grid">
      {data.map(scene => (
        <div key={scene.id} className="scene-card">
          <div className="scene-header">
            <h4>{scene.name}</h4>
            <div className="scene-actions">
              <button className="edit-btn">编辑</button>
              <button className="delete-btn">删除</button>
            </div>
          </div>
          <div className="scene-info">
            <p><strong>描述:</strong> {scene.description}</p>
            <p><strong>地理环境:</strong> {scene.geography}</p>
            <p><strong>文化特色:</strong> {scene.culture}</p>
            <p><strong>使用次数:</strong> {scene.usage_count}</p>
          </div>
          <div className="scene-tags">
            <h5>场景标签</h5>
            <div className="tags-list">
              {scene.atmosphere_tags && scene.atmosphere_tags.length > 0 ? (
                scene.atmosphere_tags.map((tag, index) => (
                  <span key={index} className="tag">{tag.tag_name}</span>
                ))
              ) : (
                <p className="no-tags">暂无标签</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// 创作技巧知识库组件
const WritingTechniqueKnowledgeBase = ({ data }) => (
  <div className="technique-knowledge">
    <div className="knowledge-section-header">
      <h3>创作技巧库</h3>
      <button className="add-button">+ 添加技巧</button>
    </div>
    <div className="techniques-grid">
      {data.map(technique => (
        <div key={technique.id} className="technique-card">
          <div className="technique-header">
            <h4>{technique.name}</h4>
            <span className="technique-category">{technique.category}</span>
          </div>
          <div className="technique-content">
            <div className="techniques-list">
              {technique.techniques && technique.techniques.map((tech, index) => (
                <div key={index} className="technique-item">
                  <h5>{tech.technique_name}</h5>
                  <p>{tech.description}</p>
                  <div className="technique-examples">
                    <strong>示例:</strong>
                    <ul>
                      {tech.examples.map((example, i) => (
                        <li key={i}>{example}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default KnowledgeBase;