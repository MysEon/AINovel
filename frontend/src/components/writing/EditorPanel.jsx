import React from 'react';
import { Layout } from 'antd';
import EditorCanvas from './EditorCanvas';
import RichTextEditor from './RichTextEditor';

const { Content } = Layout;

const EditorPanel = ({
  currentChapter,
  content,
  contentCharCount = 0,
  contentLineCount = 0,
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
          currentChapter={currentChapter}
          content={content}
          contentCharCount={contentCharCount}
          contentLineCount={contentLineCount}
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
      currentChapter={currentChapter}
      content={content}
      contentCharCount={contentCharCount}
      contentLineCount={contentLineCount}
      onContentChange={onContentChange}
      readOnly={readOnly}
    />
  );
};

export default EditorPanel;
