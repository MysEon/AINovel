import React from 'react';
import { FaPlus, FaFileAlt, FaCog, FaMagic, FaLightbulb, FaSpinner, FaUsers } from 'react-icons/fa';
import { Button, Space, Tag, Dropdown, Menu, Card } from 'antd';
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
    <Card
      className="ai-assistant-toolbar-card"
      title={
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
              style={{ color: '#1890ff' }}
            >
              新对话
            </Button>
            {selectedModelConfig && (
              <Tag color="blue" style={{ marginRight: 8 }}>
                {selectedModelConfig.name}
              </Tag>
            )}
            {selectedPromptTemplate && (
              <Tag color="green" style={{ marginRight: 8 }}>
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
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          {template.description}
                        </div>
                      </div>
                    </Menu.Item>
                  ))}
                  {promptTemplates.length === 0 && (
                    <Menu.Item disabled>
                      <span style={{ color: '#999' }}>暂无可用模板</span>
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
                style={{ color: selectedPromptTemplate ? '#52c41a' : '#8c8c8c' }}
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
                      <span style={{ color: '#999' }}>暂无可用模型配置</span>
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
      }
      style={{
        borderRadius: '8px 8px 0 0',
        flexShrink: 0
      }}
      bodyStyle={{ padding: '12px 16px' }}
    >
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
        <div style={{ marginTop: 8, color: '#999', fontSize: '12px' }}>
          请先在设置中配置AI模型
        </div>
      )}
    </Card>
  );
};

export default WritingToolbar;
