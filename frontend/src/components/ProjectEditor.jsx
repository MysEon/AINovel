import { useState, useEffect } from 'react';
import { 
  Box, 
  Flex, 
  Button, 
  Heading, 
  Text, 
  HStack, 
  VStack, 
  Icon
} from '@chakra-ui/react';
import { FaSun, FaMoon, FaDesktop, FaArrowLeft } from 'react-icons/fa';
import Sidebar from '../Sidebar';
import ProjectOverview from './ProjectOverview';
import WritingEditor from './writing/WritingEditor';
import PublishedChapters from './writing/PublishedChapters';
import KanbanBoard from './KanbanBoard';
import ModelConfigManager from './ModelConfigManager';
import KnowledgeBase from './KnowledgeBase';

const ProjectEditor = ({ user, project, onBackToDashboard, onProjectsChange }) => {
  const [activeItem, setActiveItem] = useState('项目总览');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentChapterId, setCurrentChapterId] = useState(null);
  
  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  
  // 从localStorage加载上次打开的章节
  useEffect(() => {
    const lastChapterId = localStorage.getItem(`lastChapter_${project.id}`);
    if (lastChapterId) {
      setCurrentChapterId(parseInt(lastChapterId, 10));
    }
  }, [project.id]);

  // 将当前打开的章节ID保存到localStorage
  useEffect(() => {
    if (currentChapterId) {
      localStorage.setItem(`lastChapter_${project.id}`, currentChapterId);
    } else {
      localStorage.removeItem(`lastChapter_${project.id}`);
    }
  }, [currentChapterId, project.id]);

  const menuItems = {
    '开始写作': ['开始写作'],
    '项目管理': ['模型参数选择', '提示词管理'],
    '知识库': ['知识库总览', '角色管理', '地点管理', '组织管理', '世界观管理'],
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
        return (
          <Box 
            p={8} 
            textAlign="center"
            bg="white" 
            _dark={{ bg: "gray.800" }}
            borderRadius="lg"
          >
            <VStack spacing={4}>
              <Heading size="lg" color="text.primary">进度追踪</Heading>
              <Text color="text.muted">功能待实现</Text>
            </VStack>
          </Box>
        );
      case '看板页':
        return <KanbanBoard />;
      case '已发布':
        return <PublishedChapters projectId={project.id} onProjectsChange={onProjectsChange} />;
      case '开始写作':
      case '章节管理':
        return <WritingEditor 
          projectId={project.id} 
          initialChapterId={currentChapterId}
          onChapterChange={setCurrentChapterId}
          onProjectsChange={onProjectsChange}
        />;
      case '模型参数选择':
        return <ModelConfigManager />;
      case '知识库总览':
        return <KnowledgeBase projectId={project.id} />;
      default:
        return (
          <Box 
            p={8} 
            textAlign="center"
            bg="white" 
            _dark={{ bg: "gray.800" }}
            borderRadius="lg"
          >
            <VStack spacing={4}>
              <Heading size="lg" color="text.primary">创作区域</Heading>
              <Text color="text.muted">在这里开始你的创作...</Text>
            </VStack>
          </Box>
        );
    }
  };

  return (
    <Flex h="100vh" bg="bg.canvas">
      {/* 侧边栏 */}
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
        hideBackButton={true} // 隐藏Sidebar中的返回按钮
      />
      
      {/* 主内容区域 */}
      <Box 
        flex="1" 
        display="flex" 
        flexDirection="column"
        overflow="hidden"
      >
        {/* 顶部操作栏 */}
        <Box 
          bg="white" 
          _dark={{ bg: "gray.800" }}
          borderBottom="1px" 
          borderColor="border.default"
          p={4}
        >
          <Flex 
            justify="space-between" 
            align="center"
          >
            <HStack spacing={4}>
              <Button
                leftIcon={<FaArrowLeft />}
                variant="outline"
                onClick={onBackToDashboard}
                size="sm"
              >
                返回项目列表
              </Button>
              
              <VStack align="start" spacing={0}>
                <Heading size="md" color="text.primary">
                  {project.name}
                </Heading>
                <Text fontSize="sm" color="text.secondary">
                  {activeItem}
                </Text>
              </VStack>
            </HStack>
          </Flex>
        </Box>
        
        {/* 内容区域 */}
        <Box 
          flex="1" 
          p={6}
          overflow="auto"
        >
          {renderContent()}
        </Box>
      </Box>
    </Flex>
  );
};

export default ProjectEditor;