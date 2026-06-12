import React from 'react';
import { Layout } from 'antd';
import EditorCanvas from './EditorCanvas';
import RichTextEditor from './RichTextEditor';

const { Content } = Layout;

const EditorPanel = ({
  content,
  onContentChange,
  readOnly,
  isAiAssisted = false,
  isGenerating = false,
  agentStatuses = [],
  selectedModelName,
  showCompletionActions = false,
  onAccept,
  onRewrite
}) => {
  if (isAiAssisted) {
    return (
      <Content className="editor-canvas-pane">
        <EditorCanvas
          content={content}
          onContentChange={(e) => onContentChange(e.target.value)}
          readOnly={readOnly}
          isGenerating={isGenerating}
          agentStatuses={agentStatuses}
          selectedModelName={selectedModelName}
          showCompletionActions={showCompletionActions}
          onAccept={onAccept}
          onRewrite={onRewrite}
        />
      </Content>
    );
  }

  return (
    <RichTextEditor
      content={content}
      onContentChange={onContentChange}
      readOnly={readOnly}
    />
  );
};

export default EditorPanel;
