import React, { useState, useEffect } from 'react';
import { FaPlay, FaPause, FaStop, FaCog, FaChartLine, FaMagic, FaLightbulb, FaUsers, FaBook, FaSpinner } from 'react-icons/fa';
import { aiService } from '../../services/aiService';
import { useNotification } from '../NotificationManager';
import './AIWorkflowManager.css';

const AIWorkflowManager = ({ projectId }) => {
  const [workflows, setWorkflows] = useState([]);
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  const [workflowStatus, setWorkflowStatus] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const { addNotification } = useNotification();

  // 预定义的工作流模板
  const workflowTemplates = [
    {
      id: 'chapter_creation',
      name: '章节创作工作流',
      description: '从大纲到完成的章节内容',
      icon: <FaBook />,
      steps: [
        { id: 'outline', name: '生成大纲', icon: <FaLightbulb /> },
        { id: 'draft', name: '创作草稿', icon: <FaMagic /> },
        { id: 'review', name: '内容审查', icon: <FaChartLine /> },
        { id: 'optimize', name: '优化完善', icon: <FaCog /> }
      ]
    },
    {
      id: 'character_development',
      name: '角色开发工作流',
      description: '深度开发和塑造角色',
      icon: <FaUsers />,
      steps: [
        { id: 'profile', name: '角色档案', icon: <FaUsers /> },
        { id: 'relationships', name: '关系网络', icon: <FaUsers /> },
        { id: 'dialogue', name: '对话风格', icon: <FaBook /> },
        { id: 'consistency', name: '一致性检查', icon: <FaChartLine /> }
      ]
    },
    {
      id: 'plot_enhancement',
      name: '情节优化工作流',
      description: '提升情节的吸引力和连贯性',
      icon: <FaMagic />,
      steps: [
        { id: 'analysis', name: '情节分析', icon: <FaChartLine /> },
        { id: 'suggestions', name: '改进建议', icon: <FaLightbulb /> },
        { id: 'integration', name: '整合优化', icon: <FaCog /> },
        { id: 'validation', name: '效果验证', icon: <FaChartLine /> }
      ]
    }
  ];

  useEffect(() => {
    loadWorkflows();
  }, [projectId]);

  const loadWorkflows = async () => {
    try {
      setIsLoading(true);
      const availableWorkflows = await aiService.getAvailableWorkflows();
      setWorkflows(availableWorkflows.length > 0 ? availableWorkflows : workflowTemplates);
    } catch (error) {
      // 如果后端API不可用，使用模板工作流
      setWorkflows(workflowTemplates);
      addNotification({
        message: '使用默认工作流模板: ' + error.message,
        type: 'warning'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startWorkflow = async (workflowId) => {
    try {
      setIsLoading(true);
      const workflow = workflows.find(w => w.id === workflowId);
      if (!workflow) return;

      setActiveWorkflow(workflow);
      setWorkflowStatus(prev => ({
        ...prev,
        [workflowId]: {
          status: 'running',
          currentStep: 0,
          startTime: new Date(),
          progress: 0
        }
      }));

      // 模拟工作流执行过程
      await simulateWorkflowExecution(workflow);
      
      addNotification({
        message: `工作流 "${workflow.name}" 执行完成`,
        type: 'success'
      });
    } catch (error) {
      addNotification({
        message: `工作流执行失败: ${error.message}`,
        type: 'error'
      });
      setWorkflowStatus(prev => ({
        ...prev,
        [workflowId]: {
          status: 'failed',
          error: error.message
        }
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const simulateWorkflowExecution = async (workflow) => {
    const steps = workflow.steps || [];
    for (let i = 0; i < steps.length; i++) {
      setWorkflowStatus(prev => ({
        ...prev,
        [workflow.id]: {
          ...prev[workflow.id],
          currentStep: i,
          progress: ((i + 1) / steps.length) * 100
        }
      }));
      
      // 模拟每个步骤的执行时间
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    setWorkflowStatus(prev => ({
      ...prev,
      [workflow.id]: {
        ...prev[workflow.id],
        status: 'completed',
        progress: 100,
        endTime: new Date()
      }
    }));
  };

  const stopWorkflow = (workflowId) => {
    setWorkflowStatus(prev => ({
      ...prev,
      [workflowId]: {
        ...prev[workflowId],
        status: 'stopped',
        endTime: new Date()
      }
    }));
    
    addNotification({
      message: '工作流已停止',
      type: 'info'
    });
  };

  const configureWorkflow = (workflow) => {
    setSelectedWorkflow(workflow);
    setShowConfig(true);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return <FaSpinner className="spinner" />;
      case 'completed':
        return <FaChartLine className="success" />;
      case 'failed':
        return <FaStop className="error" />;
      case 'stopped':
        return <FaPause className="warning" />;
      default:
        return <FaPlay />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return 'status-running';
      case 'completed':
        return 'status-completed';
      case 'failed':
        return 'status-failed';
      case 'stopped':
        return 'status-stopped';
      default:
        return 'status-idle';
    }
  };

  const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return '-';
    const duration = Math.floor((endTime - startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isLoading && workflows.length === 0) {
    return (
      <div className="ai-workflow-manager loading">
        <FaSpinner className="spinner" />
        <p>加载工作流...</p>
      </div>
    );
  }

  return (
    <div className="ai-workflow-manager">
      <div className="workflow-header">
        <h2>AI写作工作流</h2>
        <p>智能化创作流程管理，提升写作效率</p>
      </div>

      <div className="workflow-grid">
        {workflows.map(workflow => {
          const status = workflowStatus[workflow.id];
          const isActive = activeWorkflow?.id === workflow.id;
          
          return (
            <div 
              key={workflow.id} 
              className={`workflow-card ${isActive ? 'active' : ''} ${status ? getStatusColor(status.status) : ''}`}
            >
              <div className="workflow-header">
                <div className="workflow-icon">
                  {workflow.icon}
                </div>
                <div className="workflow-info">
                  <h3>{workflow.name}</h3>
                  <p>{workflow.description}</p>
                </div>
                <div className="workflow-status">
                  {status && getStatusIcon(status.status)}
                </div>
              </div>

              <div className="workflow-steps">
                <h4>工作流程</h4>
                <div className="steps-list">
                  {(workflow.steps || []).map((step, index) => (
                    <div 
                      key={step.id} 
                      className={`step-item ${status && status.currentStep === index ? 'active' : ''} ${status && status.currentStep > index ? 'completed' : ''}`}
                    >
                      <div className="step-icon">
                        {step.icon}
                      </div>
                      <div className="step-info">
                        <span className="step-name">{step.name}</span>
                        {status && status.currentStep === index && (
                          <span className="step-progress">
                            {Math.round(status.progress)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {status && (
                <div className="workflow-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${status.progress || 0}%` }}
                    ></div>
                  </div>
                  <div className="progress-info">
                    <span className="progress-text">
                      {status.status === 'running' ? '执行中...' : 
                       status.status === 'completed' ? '已完成' :
                       status.status === 'failed' ? '执行失败' :
                       status.status === 'stopped' ? '已停止' : '准备就绪'}
                    </span>
                    {status.startTime && (
                      <span className="duration">
                        {formatDuration(status.startTime, status.endTime)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="workflow-actions">
                <button 
                  className={`action-btn primary ${status?.status === 'running' ? 'stop' : 'start'}`}
                  onClick={() => status?.status === 'running' 
                    ? stopWorkflow(workflow.id) 
                    : startWorkflow(workflow.id)
                  }
                  disabled={isLoading}
                >
                  {status?.status === 'running' ? <FaStop /> : <FaPlay />}
                  {status?.status === 'running' ? '停止' : '启动'}
                </button>
                
                <button 
                  className="action-btn secondary"
                  onClick={() => configureWorkflow(workflow)}
                  disabled={isLoading}
                >
                  <FaCog />
                  配置
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showConfig && selectedWorkflow && (
        <WorkflowConfigDialog 
          workflow={selectedWorkflow}
          onClose={() => setShowConfig(false)}
          onSave={(config) => {
            addNotification({
              message: `工作流 "${selectedWorkflow.name}" 配置已保存`,
              type: 'success'
            });
            setShowConfig(false);
          }}
        />
      )}
    </div>
  );
};

const WorkflowConfigDialog = ({ workflow, onClose, onSave }) => {
  const [config, setConfig] = useState({
    autoStart: false,
    retryOnError: true,
    maxRetries: 3,
    timeout: 300,
    notifications: true
  });

  const handleSave = () => {
    onSave(config);
  };

  return (
    <div className="workflow-config-dialog-overlay">
      <div className="workflow-config-dialog">
        <div className="dialog-header">
          <h3>配置工作流: {workflow.name}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="dialog-content">
          <div className="config-section">
            <h4>执行设置</h4>
            <div className="config-item">
              <label>
                <input 
                  type="checkbox" 
                  checked={config.autoStart}
                  onChange={(e) => setConfig(prev => ({ ...prev, autoStart: e.target.checked }))}
                />
                自动启动
              </label>
            </div>
            
            <div className="config-item">
              <label>
                <input 
                  type="checkbox" 
                  checked={config.retryOnError}
                  onChange={(e) => setConfig(prev => ({ ...prev, retryOnError: e.target.checked }))}
                />
                出错时重试
              </label>
            </div>
            
            {config.retryOnError && (
              <div className="config-item">
                <label>最大重试次数:</label>
                <input 
                  type="number" 
                  min="1" 
                  max="10" 
                  value={config.maxRetries}
                  onChange={(e) => setConfig(prev => ({ ...prev, maxRetries: parseInt(e.target.value) }))}
                />
              </div>
            )}
            
            <div className="config-item">
              <label>超时时间(秒):</label>
              <input 
                type="number" 
                min="30" 
                max="3600" 
                value={config.timeout}
                onChange={(e) => setConfig(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
              />
            </div>
          </div>
          
          <div className="config-section">
            <h4>通知设置</h4>
            <div className="config-item">
              <label>
                <input 
                  type="checkbox" 
                  checked={config.notifications}
                  onChange={(e) => setConfig(prev => ({ ...prev, notifications: e.target.checked }))}
                />
                启用通知
              </label>
            </div>
          </div>
        </div>
        
        <div className="dialog-actions">
          <button className="cancel-btn" onClick={onClose}>取消</button>
          <button className="save-btn" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
};

export default AIWorkflowManager;