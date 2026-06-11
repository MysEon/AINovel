import React from 'react';
import { FaSave, FaRobot, FaFont, FaExchangeAlt } from 'react-icons/fa';
import { Button, Tooltip } from 'antd';

const SessionPanel = ({
  contentCharCount,
  contentLineCount,
  isSaving,
  onSave,
  aiAssisted,
  onToggleAiAssisted,
  aiMode,
  onAiModeChange,
  layoutMode,
  onToggleLayout
}) => {
  return (
    <div className="footer-panel footer-panel-session">
      <div className="footer-panel-head">
        <div className="footer-panel-title">
          <FaSave />
          <span>写作控制</span>
        </div>
        <div className="footer-metrics" aria-label="当前内容统计">
          <div className="footer-metric">
            <strong>{contentCharCount}</strong>
            <span>字</span>
          </div>
          <div className="footer-metric">
            <strong>{contentLineCount}</strong>
            <span>行</span>
          </div>
        </div>
      </div>

      <div className="footer-action-row">
        <button
          className="save-button footer-save-btn"
          onClick={onSave}
          disabled={isSaving}
          title="保存内容 (Ctrl+S)"
        >
          <FaSave />
          <span>{isSaving ? '保存中...' : '保存草稿'}</span>
        </button>
        <button
          className={`ai-toggle-button footer-ai-toggle ${aiAssisted ? 'active' : ''}`}
          onClick={onToggleAiAssisted}
          aria-label={aiAssisted ? "关闭AI辅助" : "开启AI辅助"}
        >
          {aiAssisted ? <FaRobot /> : <FaFont />}
          <span>{aiAssisted ? "AI辅助中" : "AI辅助"}</span>
        </button>
      </div>

      {aiAssisted && (
        <div className="footer-ai-inline">
          <div className="footer-ai-inline-head">
            <FaRobot />
            <span>AI写作控制</span>
          </div>
          <div className="footer-ai-inline-body">
            <div className="ai-mode-selector">
              <span className="ai-mode-label">AI模式:</span>
              <div className="ai-mode-buttons">
                <button
                  className={`ai-mode-button ${aiMode === 'optimize' ? 'active' : ''}`}
                  onClick={() => onAiModeChange('optimize')}
                >
                  辅助优化型
                </button>
                <button
                  className={`ai-mode-button ${aiMode === 'takeover' ? 'active' : ''}`}
                  onClick={() => onAiModeChange('takeover')}
                >
                  全面接管型
                </button>
              </div>
            </div>
            <Tooltip title={layoutMode === 'left' ? '切换到右侧聊天' : '切换到左侧聊天'}>
              <Button
                type="default"
                icon={<FaExchangeAlt />}
                onClick={onToggleLayout}
                size="small"
                className="layout-toggle-button footer-layout-toggle"
              >
                布局
              </Button>
            </Tooltip>
          </div>
        </div>
      )}

      <div className="footer-panel-subtext">
        先保存草稿再发布更稳妥，支持快捷键 <kbd>Ctrl</kbd> + <kbd>S</kbd>。
      </div>
    </div>
  );
};

export default SessionPanel;
