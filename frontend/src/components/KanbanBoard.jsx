import React from 'react';
import './KanbanBoard.css';

const KanbanBoard = () => {
  return (
    <div className="kanban-container">
      <h1>项目看板</h1>
      <p>看板功能正在开发中...</p>
      <div className="kanban-placeholder">
        <div className="kanban-column">
          <h3>待办</h3>
          <div className="kanban-card">创建角色设定</div>
          <div className="kanban-card">设计故事大纲</div>
        </div>
        <div className="kanban-column">
          <h3>进行中</h3>
          <div className="kanban-card">编写第一章</div>
          <div className="kanban-card">完善世界观</div>
        </div>
        <div className="kanban-column">
          <h3>已完成</h3>
          <div className="kanban-card">项目初始化</div>
          <div className="kanban-card">基础设定完成</div>
        </div>
      </div>
    </div>
  );
};

export default KanbanBoard;