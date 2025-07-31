import React, { useState, useEffect } from 'react';
import { FaPlus, FaBook, FaClock, FaEdit, FaTrash, FaCalendarAlt } from 'react-icons/fa';

const ProjectDashboard = ({ user, projects, onSelectProject, onCreateProject, onDeleteProject, onLogout }) => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');

  // 确保主题在仪表板页面正确应用
  useEffect(() => {
    // 如果body没有主题类，应用默认主题
    if (!document.body.className.includes('-theme')) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.body.className = prefersDark ? 'dark-theme' : 'light-theme';
    }
  }, []);

  const handleCreateProject = (e) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      onCreateProject({
        name: newProjectName.trim(),
        description: newProjectDescription.trim()
      });
      setNewProjectName('');
      setNewProjectDescription('');
      setShowCreateDialog(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getProjectStats = (project) => {
    // 使用真实的项目统计数据（如果后端提供）或者默认值
    return {
      wordCount: project.word_count || 0,
      chapters: project.chapter_count || 0,
      lastUpdated: project.updated_at || project.created_at
    };
  };

  return (
    <div className="project-dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <h1>我的项目</h1>
          <p>欢迎回来，{user?.name || '用户'}</p>
        </div>
        <div className="header-right">
          <button className="create-project-btn" onClick={() => setShowCreateDialog(true)}>
            <FaPlus />
            新建项目
          </button>
          <div className="user-menu">
            <img src={user?.avatar || '/default-avatar.png'} alt={user?.name || '用户'} className="user-avatar" />
            <button className="logout-btn" onClick={onLogout}>
              退出登录
            </button>
          </div>
        </div>
      </header>

      <div className="projects-grid">
        {projects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <FaBook />
            </div>
            <h3>还没有项目</h3>
            <p>创建您的第一个小说项目开始创作之旅</p>
            <button className="create-first-project-btn" onClick={() => setShowCreateDialog(true)}>
              <FaPlus />
              创建项目
            </button>
          </div>
        ) : (
          projects.map(project => {
            const stats = getProjectStats(project);
            return (
              <div key={project.id} className="project-card">
                <div className="project-header">
                  <h3>{project.name}</h3>
                  <div className="project-actions">
                    <button 
                      className="action-btn edit-btn"
                      onClick={() => onSelectProject(project.id)}
                      title="编辑项目"
                    >
                      <FaEdit />
                    </button>
                    <button 
                      className="action-btn delete-btn"
                      onClick={() => onDeleteProject(project.id)}
                      title="删除项目"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
                
                {project.description && (
                  <p className="project-description">{project.description}</p>
                )}
                
                <div className="project-stats">
                  <div className="stat-item">
                    <span className="stat-label">字数</span>
                    <span className="stat-value">{stats.wordCount.toLocaleString()}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">章节</span>
                    <span className="stat-value">{stats.chapters}</span>
                  </div>
                </div>
                
                <div className="project-footer">
                  <div className="last-updated">
                    <FaCalendarAlt />
                    <span>更新于 {formatDate(stats.lastUpdated)}</span>
                  </div>
                  <button 
                    className="open-project-btn"
                    onClick={() => onSelectProject(project.id)}
                  >
                    打开项目
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 创建项目对话框 */}
      {showCreateDialog && (
        <div className="modal-overlay" onClick={() => setShowCreateDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>创建新项目</h2>
              <button 
                className="modal-close"
                onClick={() => setShowCreateDialog(false)}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleCreateProject} className="create-project-form">
              <div className="form-group">
                <label>项目名称 *</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="输入项目名称"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>项目描述</label>
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="简要描述您的小说项目（可选）"
                  rows="3"
                />
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => setShowCreateDialog(false)}
                >
                  取消
                </button>
                <button type="submit" className="confirm-btn">
                  创建项目
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDashboard;