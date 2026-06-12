import React from 'react';
import { FaCog, FaExchangeAlt, FaFont, FaRobot, FaSave } from 'react-icons/fa';

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

      <div className="footer-action-row">
        <button
          className="save-button footer-save-btn"
          onClick={onSave}
          disabled={isSaving}
          title="保存内容 (Ctrl+S)"
        >
          <FaSave />
          <span>{isSaving ? '保存中...' : '保存'}</span>
        </button>

        <button
          className={`ai-toggle-button footer-ai-toggle ${aiAssisted ? 'active' : ''}`}
          onClick={onToggleAiAssisted}
          aria-label={aiAssisted ? '关闭 AI 辅助' : '开启 AI 辅助'}
          title={aiAssisted ? '关闭 AI 辅助' : '开启 AI 辅助'}
        >
          {aiAssisted ? <FaRobot /> : <FaFont />}
          <span>{aiAssisted ? 'AI 开' : 'AI'}</span>
        </button>

        {aiAssisted && (
          <details className="footer-options-menu footer-ai-options">
            <summary className="footer-options-trigger icon-only" title="AI 设置">
              <FaCog />
              <span>AI 设置</span>
            </summary>

            <div className="footer-options-popover footer-ai-inline">
              <div className="ai-mode-selector">
                <span className="ai-mode-label">AI 模式</span>
                <div className="ai-mode-buttons">
                  <button
                    className={`ai-mode-button ${aiMode === 'optimize' ? 'active' : ''}`}
                    onClick={() => onAiModeChange('optimize')}
                  >
                    辅助优化
                  </button>
                  <button
                    className={`ai-mode-button ${aiMode === 'takeover' ? 'active' : ''}`}
                    onClick={() => onAiModeChange('takeover')}
                  >
                    全面接管
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="layout-toggle-button footer-layout-toggle"
                onClick={onToggleLayout}
                title={layoutMode === 'left' ? '切换到右侧聊天' : '切换到左侧聊天'}
              >
                <FaExchangeAlt />
                <span>{layoutMode === 'left' ? '聊天在左' : '聊天在右'}</span>
              </button>
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

export default SessionPanel;
