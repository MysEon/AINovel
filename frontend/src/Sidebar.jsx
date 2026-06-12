import React from 'react';
import {
  FaBook, FaCog, FaLightbulb, FaStream, FaBox, FaPaperPlane, FaBars, FaTimes,
  FaComments, FaLanguage, FaHeart, FaHistory, FaChartBar, FaClock, FaPlus, FaChevronDown, FaArrowLeft
} from 'react-icons/fa';
import {
  IoPersonCircle, IoLocationSharp, IoPeople, IoGlobeSharp, IoLibrary, IoTime
} from 'react-icons/io5';

const menuIcons = {
  '开始写作': <FaBook />,
  '模型参数选择': <FaCog />,
  '提示词管理': <FaLightbulb />,
  '角色管理': <IoPersonCircle />,
  '地点管理': <IoLocationSharp />,
  '组织管理': <IoPeople />,
  '世界观管理': <IoGlobeSharp />,
  '主线大纲': <FaStream />,
  '章节管理': <IoLibrary />,
  '时间线': <IoTime />,
  '对话生成': <FaComments />,
  '语言润色': <FaLanguage />,
  '情感分析': <FaHeart />,
  '已发布': <FaPaperPlane />,
  '历史版本': <FaHistory />,
  '进度追踪': <FaClock />,
  '项目总览': <FaBook />,
};

const Sidebar = ({
  menuItems,
  activeItem,
  setActiveItem,
  isCollapsed,
  toggleSidebar,
  currentProject,
  projects,
  setCurrentProject,
  onCreateProject,
  hideProjectSelector = false,
  projectName,
  onBackToDashboard,
  hideBackButton = false,
  onToggleTheme,
  themeInfo
}) => {
  return (
    <nav className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {!isCollapsed && hideProjectSelector && onBackToDashboard && !hideBackButton && (
        <>
          <div className="project-header-with-back">
            <button className="compact-back-btn" onClick={onBackToDashboard} title="返回项目列表">
              <FaArrowLeft />
            </button>
          </div>
          <div className="project-info-separate">
            <span className="project-label">当前项目</span>
            <span className="project-name-compact">{projectName}</span>
          </div>
        </>
      )}

      <div className="sidebar-header">
        <div className="project-section">
          {!isCollapsed && !hideProjectSelector && (
            <div className="project-selector">
              <select
                value={currentProject || ''}
                onChange={(e) => setCurrentProject(e.target.value || null)}
                className="project-dropdown"
              >
                <option value="">选择项目</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <button
                className="new-project-btn"
                onClick={onCreateProject}
                title="新建项目"
              >
                <FaPlus />
              </button>
            </div>
          )}

          {!isCollapsed && (
            <div className="app-title-section">
              <h1>AINovel</h1>
              <span className="app-subtitle">智能小说创作平台</span>
              {hideProjectSelector && projectName && (
                <div className="sidebar-project-card" title={projectName}>
                  <span>当前项目</span>
                  <strong>{projectName}</strong>
                </div>
              )}
            </div>
          )}
        </div>
        <button className="collapse-btn" onClick={toggleSidebar}>
          {isCollapsed ? <FaBars /> : <FaTimes />}
        </button>
      </div>

      {(currentProject || hideProjectSelector) && (
        <div className="sidebar-menu">
          {Object.entries(menuItems).map(([section, items]) => (
            <div key={section} className="menu-section">
              {!isCollapsed && section !== '开始写作' && <h3>{section}</h3>}
              <ul>
                {items.map((item) => (
                  <li
                    key={item}
                    className={`${activeItem === item ? 'active' : ''} ${item === '开始写作' ? 'start-writing' : ''}`}
                  >
                    <a href="#" onClick={(e) => { e.preventDefault(); setActiveItem(item); }} data-title={item}>
                      {menuIcons[item] || <FaBook />}
                      {!isCollapsed && <span>{item}</span>}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {!currentProject && !hideProjectSelector && !isCollapsed && (
        <div className="no-project-message">
        </div>
      )}

      {(onBackToDashboard || onToggleTheme) && (
        <div className="sidebar-utility-panel" aria-label="项目操作">
          {onBackToDashboard && (
            <button
              type="button"
              className="sidebar-utility-button"
              onClick={onBackToDashboard}
              title="返回项目列表"
            >
              <FaArrowLeft />
              {!isCollapsed && <span>返回项目列表</span>}
            </button>
          )}
          {onToggleTheme && themeInfo && (
            <button
              type="button"
              className="sidebar-utility-button"
              onClick={onToggleTheme}
              title="切换主题模式"
            >
              {themeInfo.icon}
              {!isCollapsed && <span>{themeInfo.text}</span>}
            </button>
          )}
        </div>
      )}
    </nav>
  );
};

export default Sidebar;
