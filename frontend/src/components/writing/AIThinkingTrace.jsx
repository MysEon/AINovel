import React, { useEffect, useState } from 'react';
import { Collapse } from 'antd';
import { AlertOutlined, CheckCircleOutlined, LoadingOutlined, ToolOutlined } from '@ant-design/icons';
import { EVENT_TYPES, NODE_LABELS, TOOL_LABELS } from '../../config/agentEventTypes';
import './AIThinkingTrace.css';

const AIThinkingTrace = ({ events, status, errorMessage }) => {
  // 流式时默认展开，结束时自动折叠。
  const [activeKey, setActiveKey] = useState(['trace']);

  useEffect(() => {
    if (status === 'streaming') setActiveKey(['trace']);
    else if (status === 'done' || status === 'error') setActiveKey([]);
  }, [status]);

  if (!events || events.length === 0) return null;

  // 步骤数 = node_start 数 + tool_start 数（tool_end 不计；node_end 不计）。
  const stepCount = events.filter((event) => (
    event.kind === EVENT_TYPES.NODE_START || event.kind === EVENT_TYPES.TOOL_START
  )).length;

  const headerText = (() => {
    if (status === 'streaming') return `思考中（已完成 ${stepCount} 步）`;
    if (status === 'error') return `思考轨迹（${stepCount} 步，已中断）`;
    return `思考轨迹（${stepCount} 步）`;
  })();

  return (
    <div className={`ai-thinking-trace-wrapper ${status || 'idle'}`}>
      <Collapse
        ghost
        size="small"
        activeKey={activeKey}
        onChange={(keys) => setActiveKey(Array.isArray(keys) ? keys : [keys].filter(Boolean))}
        items={[{
          key: 'trace',
          label: (
            <span className="ai-thinking-trace-header">
              {status === 'streaming' && <LoadingOutlined spin />}
              {status === 'done' && <CheckCircleOutlined className="ai-thinking-trace-done-icon" />}
              {status === 'error' && <AlertOutlined className="ai-thinking-trace-alert-icon" />}
              <span>{headerText}</span>
            </span>
          ),
          children: (
            <div className="ai-thinking-trace-body">
              {events.map((event, index) => <TraceItem key={`${event.kind}-${event.name || 'event'}-${event.ts || index}`} event={event} />)}
              {status === 'error' && errorMessage && (
                <div className="ai-thinking-trace-error">{errorMessage}</div>
              )}
            </div>
          ),
        }]}
      />
    </div>
  );
};

const TraceItem = ({ event }) => {
  if (event.kind === EVENT_TYPES.NODE_START) {
    const label = event.label || NODE_LABELS[event.name] || event.name;
    return (
      <div className="ai-thinking-trace-step node">
        <span className="ai-thinking-trace-bullet">●</span>
        <span className="ai-thinking-trace-label">{label}</span>
      </div>
    );
  }

  if (event.kind === EVENT_TYPES.TOOL_START) {
    const label = TOOL_LABELS[event.name] || event.name;
    const argsText = event.args ? JSON.stringify(event.args, null, 0) : '';
    return (
      <div className="ai-thinking-trace-step tool">
        <ToolOutlined className="ai-thinking-trace-tool-icon" />
        <div className="ai-thinking-trace-tool-body">
          <div className="ai-thinking-trace-label">{label}</div>
          {argsText && <div className="ai-thinking-trace-args">参数：{argsText}</div>}
        </div>
      </div>
    );
  }

  if (event.kind === EVENT_TYPES.TOOL_END) {
    const truncatedSuffix = event.truncated ? '（截断）' : '';
    return (
      <div className="ai-thinking-trace-step tool-end">
        <span className="ai-thinking-trace-result-label">返回{truncatedSuffix}：</span>
        <span className="ai-thinking-trace-result">{event.result}</span>
      </div>
    );
  }

  return null;
};

export default AIThinkingTrace;
