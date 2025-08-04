import React, { useState, useEffect } from 'react';
import { FaBook, FaList, FaEye, FaDownload, FaPrint } from 'react-icons/fa';
import { getChapters } from '../services/chapterService';
import { useNotification } from './NotificationManager';
import './ProjectOverview.css';

const ProjectOverview = ({ project, onNavigateToDrafts }) => {
  const [activeTab, setActiveTab] = useState('content');
  const [readingMode, setReadingMode] = useState(false);
  const [publishedChapters, setPublishedChapters] = useState([]);
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotification();

  // 获取已发布的章节数据
  useEffect(() => {
    const fetchPublishedChapters = async () => {
      if (!project?.id) return;
      
      setLoading(true);
      try {
        const allChapters = await getChapters(project.id);
        const published = allChapters.filter(chapter => chapter.status === 'published');
        setPublishedChapters(published);
      } catch (error) {
        console.error('获取已发布章节失败:', error);
        // 如果获取失败，使用空数组
        setPublishedChapters([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPublishedChapters();
  }, [project?.id]);

  const totalWordCount = publishedChapters.reduce((sum, chapter) => sum + (chapter.word_count || 0), 0);

  const handleExport = (format) => {
    // 导出功能实现
    addNotification({
      message: `导出为${format}格式功能待实现`,
      type: 'info',
      duration: 3000
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (readingMode) {
    return (
      <div className="reading-mode">
        <div className="reading-header">
          <h1>{project.name}</h1>
          <button onClick={() => setReadingMode(false)}>退出阅读模式</button>
        </div>
        <div className="reading-content">
          {publishedChapters.map((chapter) => (
            <div key={chapter.id} className="chapter-section">
              <h2>第{chapter.chapter_number}章 {chapter.title}</h2>
              <p>{chapter.content}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="project-overview">
      <div className="overview-header">
        <h1>{project.name} - 项目总览</h1>
        <div className="overview-actions">
          <button className="btn-primary" onClick={onNavigateToDrafts}>
            <FaBook /> 开始编写
          </button>
          <button className="btn-secondary" onClick={() => setReadingMode(true)} disabled={publishedChapters.length === 0}>
            <FaEye /> 阅读模式
          </button>
          <button className="btn-secondary" onClick={() => handleExport('PDF')} disabled={publishedChapters.length === 0}>
            <FaDownload /> 导出PDF
          </button>
          <button className="btn-secondary" onClick={handlePrint} disabled={publishedChapters.length === 0}>
            <FaPrint /> 打印
          </button>
        </div>
      </div>
      
      {publishedChapters.length === 0 && !loading && (
        <div className="empty-project-notice">
          <h3>欢迎使用AINovel创作平台！</h3>
          <p>您的项目目前还没有已发布的章节。</p>
          <button className="btn-primary" onClick={onNavigateToDrafts}>
            <FaBook /> 立即开始创作
          </button>
          <p>点击"开始编写"按钮创建您的第一个章节。</p>
        </div>
      )}

      <div className="overview-stats">
        <div className="stat-card">
          <div className="stat-icon">
            <FaBook />
          </div>
          <div className="stat-info">
            <h3>{publishedChapters.length}</h3>
            <p>已发布章节数</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <FaList />
          </div>
          <div className="stat-info">
            <h3>{totalWordCount}</h3>
            <p>已发布总字数</p>
          </div>
        </div>
      </div>

      <div className="overview-content">
        <div className="tabs">
          <button 
            className={activeTab === 'content' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('content')}
          >
            内容结构
          </button>
          <button 
            className={activeTab === 'chapters' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('chapters')}
          >
            章节列表
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'content' && (
            <div className="content-structure">
              <h3>项目结构</h3>
              <div className="structure-tree">
                <div className="tree-item">
                  <FaBook /> {project.name}
                  <div className="tree-children">
                    {publishedChapters.length > 0 ? (
                      publishedChapters.map((chapter) => (
                        <div key={chapter.id} className="tree-item">
                          <FaList /> 第{chapter.chapter_number}章 {chapter.title} ({chapter.word_count || 0}字)
                        </div>
                      ))
                    ) : (
                      <div className="tree-item empty-structure">
                        <FaList /> 暂无已发布章节
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'chapters' && (
            <div className="chapter-list">
              <h3>已发布章节列表</h3>
              <table className="chapters-table">
                <thead>
                  <tr>
                    <th>章节</th>
                    <th>标题</th>
                    <th>字数</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {publishedChapters.map((chapter) => (
                    <tr key={chapter.id}>
                      <td>第{chapter.chapter_number}章</td>
                      <td>{chapter.title}</td>
                      <td>{chapter.word_count || 0}</td>
                      <td>
                        <button className="btn-small">预览</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectOverview;