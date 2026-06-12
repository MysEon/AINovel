import React from 'react';
import { FaPlus, FaFileAlt, FaCog, FaMagic, FaLightbulb, FaSpinner, FaUsers } from 'react-icons/fa';
import { Button, Space, Tag, Dropdown, Menu } from 'antd';
import AgentStatusBadge from './AgentStatusBadge';

const WritingToolbar = ({
  isLoading,
  selectedModelConfig,
  selectedPromptTemplate,
  promptTemplates,
  modelConfigs,
  isLoadingTemplates,
  agentStatuses,
  onNewChat,
  onAIAction,
  onModelConfigChange,
  onPromptTemplateSelect
}) => {
  return (
    <div className="ai-assistant-toolbar-card">
      <div className="ai-assistant-toolbar-header">
        <div className="ai-assistant-toolbar-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="ai-assistant-title-group">
            <span className="ai-assistant-title-text">AI写作助手</span>
            {isLoading && <span className="ai-assistant-live-pill">协作中</span>}
          </div>
          <div className="ai-assistant-toolbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              type="text"
              size="small"
              icon={<FaPlus />}
              onClick={onNewChat}
              title="开启新对话"
              disabled={isLoading}
              style={{ color: 'var(--primary-color)' }}
            >
              新对话
            </Button>
            {selectedModelConfig && (
              <Tag style={{ marginRight: 8, background: 'var(--primary-color)', color: 'var(--active-menu-text)', borderColor: 'var(--primary-color)' }}>
                {selectedModelConfig.name}
              </Tag>
            )}
            {selectedPromptTemplate && (
              <Tag style={{ marginRight: 8, background: 'var(--success-color)', color: 'var(--active-menu-text)', borderColor: 'var(--success-color)' }}>
                {selectedPromptTemplate.name}
              </Tag>
            )}
            <Dropdown
              overlay={
                <Menu onClick={(e) => {
                  const templateId = parseInt(e.key);
                  onPromptTemplateSelect(templateId);
                }}>
                  {promptTemplates.map(template => (
                    <Menu.Item key={template.id}>
                      <div>
                        <div>{template.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted-text-color)' }}>
                          {template.description}
                        </div>
                      </div>
                    </Menu.Item>
                  ))}
                  {promptTemplates.length === 0 && (
                    <Menu.Item disabled>
                      <span style={{ color: 'var(--muted-text-color)' }}>暂无可用模板</span>
                    </Menu.Item>
                  )}
                </Menu>
              }
              trigger={['click']}
            >
              <Button
                type="text"
                size="small"
                icon={<FaFileAlt />}
                title="选择提示词模板"
                loading={isLoadingTemplates}
                style={{ color: selectedPromptTemplate ? 'var(--success-color)' : 'var(--muted-text-color)' }}
              />
            </Dropdown>
            <Dropdown
              overlay={
                <Menu onClick={(e) => onModelConfigChange(parseInt(e.key))}>
                  {modelConfigs.map(config => (
                    <Menu.Item key={config.id}>
                      {config.name} ({config.model_type})
                    </Menu.Item>
                  ))}
                  {modelConfigs.length === 0 && (
                    <Menu.Item disabled>
                      <span style={{ color: 'var(--muted-text-color)' }}>暂无可用模型配置</span>
                    </Menu.Item>
                  )}
                </Menu>
              }
              trigger={['click']}
            >
              <Button
                type="text"
                size="small"
                icon={<FaCog />}
                title="选择AI模型"
                loading={false}
              />
            </Dropdown>
          </div>
        </div>
      </div>
      <div className="ai-assistant-toolbar-body">
        <div className="ai-toolbar-status-strip" aria-live="polite">
          {agentStatuses.map((agent) => (
            <AgentStatusBadge
              key={`panel-${agent.id}`}
              name={agent.name}
              status={agent.status}
              active={agent.active}
              tone={agent.tone}
            />
          ))}
        </div>
        <Space wrap>
          <Button
            className="ai-quick-action-btn"
            icon={<FaMagic />}
            onClick={() => onAIAction('outline')}
            disabled={isLoading || modelConfigs.length === 0}
            size="small"
          >
            大纲
          </Button>
          <Button
            className="ai-quick-action-btn"
            icon={<FaLightbulb />}
            onClick={() => onAIAction('suggestions')}
            disabled={isLoading || modelConfigs.length === 0}
            size="small"
          >
            建议
          </Button>
          <Button
            className="ai-quick-action-btn"
            icon={<FaSpinner />}
            onClick={() => onAIAction('optimize')}
            disabled={isLoading || modelConfigs.length === 0}
            size="small"
          >
            优化
          </Button>
          <Button
            className="ai-quick-action-btn"
            icon={<FaUsers />}
            onClick={() => onAIAction('ideas')}
            disabled={isLoading || modelConfigs.length === 0}
            size="small"
          >
            创意
          </Button>
        </Space>
        {modelConfigs.length === 0 && (
          <div style={{ marginTop: 8, color: 'var(--muted-text-color)', fontSize: '12px' }}>
            请先在设置中配置AI模型
          </div>
        )}
      </div>
    </div>
  );
};

export default WritingToolbar;
