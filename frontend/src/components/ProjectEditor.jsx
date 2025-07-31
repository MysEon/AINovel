import { useState, useEffect } from 'react';
import Sidebar from '../Sidebar';
import ProjectOverview from './ProjectOverview';
import WritingEditor from './writing/WritingEditor';
import PublishedChapters from './writing/PublishedChapters';
import KanbanBoard from './KanbanBoard';
import { FaSun, FaMoon, FaDesktop, FaArrowLeft } from 'react-icons/fa';
import './ProjectEditor.css';

const ProjectEditor = ({ user, project, onBackToDashboard }) => {
  const [theme, setTheme] = useState('system');
  const [actualTheme, setActualTheme] = useState('dark');
  const [activeItem, setActiveItem] = useState('项目总览');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // 检测系统主题
  const getSystemTheme = () => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  // 主题切换逻辑
  const toggleTheme = () => {
    const themeOrder = ['system', 'light', 'dark'];
    const currentIndex = themeOrder.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themeOrder.length;
    setTheme(themeOrder[nextIndex]);
  };

  // 获取主题图标和文本
  const getThemeInfo = () => {
    switch (theme) {
      case 'system': 
        return { icon: <FaDesktop />, text: '跟随系统' };
      case 'light': 
        return { icon: <FaSun />, text: '亮色模式' };
      case 'dark': 
        return { icon: <FaMoon />, text: '暗色模式' };
      default: 
        return { icon: <FaDesktop />, text: '跟随系统' };
    }
  };

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e) => {
      if (theme === 'system') {
        setActualTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addListener(handleSystemThemeChange);
    
    return () => mediaQuery.removeListener(handleSystemThemeChange);
  }, [theme]);

  // 更新实际主题
  useEffect(() => {
    let newActualTheme;
    if (theme === 'system') {
      newActualTheme = getSystemTheme();
    } else {
      newActualTheme = theme;
    }
    setActualTheme(newActualTheme);
  }, [theme]);

  // 应用主题到body
  useEffect(() => {
    document.body.className = actualTheme + '-theme';
  }, [actualTheme]);

  const menuItems = {
    '开始写作': ['开始写作'],
    '项目管理': ['模型参数选择', '提示词管理'],
    '知识库': ['角色管理', '地点管理', '组织管理', '世界观管理'],
    '剧情结构': ['主线大纲', '章节管理', '时间线'],
    '写作辅助': ['对话生成', '语言润色', '情感分析'],
    '创作库': ['已发布', '历史版本'],
    '项目看板': ['项目总览', '进度追踪', '看板页'],
  };

  const renderContent = () => {
    switch (activeItem) {
      case '项目总览':
        return <ProjectOverview 
          project={project} 
          onNavigateToDrafts={() => setActiveItem('开始写作')}
        />;
      case '进度追踪':
        return <div className="progress-tracking">进度追踪功能待实现</div>;
      case '看板页':
        return <KanbanBoard />;
      case '已发布':
        return <PublishedChapters projectId={project.id} />;
      case '开始写作':
      case '章节管理':
        return <WritingEditor projectId={project.id} />;
      default:
        return <textarea placeholder="在这里开始你的创作..."></textarea>;
    }
  };

  return (
    <div className={`app-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar 
        menuItems={menuItems}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
        isCollapsed={isSidebarCollapsed}
        toggleSidebar={toggleSidebar}
        currentProject={project.id}
        projects={[project]}
        setCurrentProject={() => {}} // 在编辑器中不允许切换项目
        onCreateProject={() => {}} // 在编辑器中不允许创建项目
        hideProjectSelector={true} // 隐藏项目选择器
        projectName={project.name} // 显示项目名称
        onBackToDashboard={onBackToDashboard}
      />
      <main className="content">
        <header>
          <div className="content-title">
            <h1>{activeItem}</h1>
            <p className="project-name">项目：{project.name}</p>
          </div>
          <button onClick={toggleTheme} className="theme-toggle">
            {getThemeInfo().icon}
            <span>{getThemeInfo().text}</span>
          </button>
        </header>
        {renderContent()}
      </main>
    </div>
  );
};

export default ProjectEditor;