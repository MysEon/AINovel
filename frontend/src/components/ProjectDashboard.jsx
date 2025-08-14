import React, { useState } from 'react';
import { 
  Box, 
  Flex, 
  Heading, 
  Text, 
  Button,
  Avatar,
  Input,
  Textarea,
  HStack,
  VStack
} from '@chakra-ui/react';
import { 
  FaPlus, 
  FaBook, 
  FaSignOutAlt 
} from 'react-icons/fa';
import { useNotification } from './NotificationManager';

const ProjectDashboard = ({ user, projects, onSelectProject, onCreateProject, onDeleteProject, onLogout }) => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const { showConfirmDialog, addNotification } = useNotification();

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
      
      addNotification({
        message: `项目 "${newProjectName.trim()}" 已创建`,
        type: "success",
        duration: 3000
      });
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
    return {
      wordCount: project.word_count || 0,
      chapters: project.chapter_count || 0,
      lastUpdated: project.updated_at || project.created_at
    };
  };

  const handleDeleteProject = (project) => {
    showConfirmDialog({
      title: '确认删除项目',
      message: `您确定要删除项目 "${project.name}" 吗？此操作无法撤销。`,
      type: 'error',
      confirmText: '确认删除',
      onConfirm: () => onDeleteProject(project.id)
    });
  };

  console.log('ProjectDashboard render:', { user, projects: projects.length });
  
  return (
    <Box 
      minH="100vh" 
      bg="gray.50"
      p={6}
    >
      {/* 页面头部 */}
      <Box 
        bg="white" 
        _dark={{ bg: "gray.800" }}
        borderRadius="lg" 
        boxShadow="sm" 
        p={6} 
        mb={6}
      >
        <Flex 
          justify="space-between" 
          align="center"
        >
          <Box>
            <Heading 
              size="lg" 
              color="gray.800" 
              mb={1}
            >
              我的项目
            </Heading>
            <Text 
              color="gray.600" 
              fontSize="lg"
            >
              欢迎回来，{user?.name || '用户'}
            </Text>
          </Box>
          
          <HStack spacing={4}>
            <Button
              leftIcon={<FaPlus />}
              colorScheme="blue"
              onClick={() => setShowCreateDialog(true)}
              size="lg"
            >
              新建项目
            </Button>
            
            <HStack spacing={3}>
              <Avatar 
                size="md" 
                src={user?.avatar} 
                name={user?.name || '用户'}
              />
              <Button
                leftIcon={<FaSignOutAlt />}
                variant="ghost"
                colorScheme="red"
                onClick={onLogout}
                size="sm"
              >
                退出登录
              </Button>
            </HStack>
          </HStack>
        </Flex>
      </Box>

      {/* 项目网格 */}
      {projects.length === 0 ? (
        <Box 
          bg="white" 
          _dark={{ bg: "gray.800" }}
          borderRadius="lg" 
          p={12} 
          textAlign="center"
        >
          <VStack spacing={6}>
            <Box
              w="20"
              h="20"
              bg="blue.50"
              _dark={{ bg: "blue.900" }}
              borderRadius="full"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Icon as={FaBook} fontSize="3xl" color="blue.500" />
            </Box>
            
            <VStack spacing={2}>
              <Heading size="md" color="gray.800">
                还没有项目
              </Heading>
              <Text color="gray.500">
                创建您的第一个小说项目，开始创作之旅
              </Text>
            </VStack>
            
            <Button
              leftIcon={<FaPlus />}
              colorScheme="blue"
              onClick={() => setShowCreateDialog(true)}
              size="lg"
            >
              创建项目
            </Button>
          </VStack>
        </Box>
      ) : (
        <Box>
          <Text>Projects: {projects.length}</Text>
          {projects.map(project => (
            <Box key={project.id} p={4} border="1px solid" borderColor="gray.200" mb={4}>
              <Text>{project.name}</Text>
              <Text>{project.description}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* 创建项目对话框 */}
      {showCreateDialog && (
        <Box
          position="fixed"
          top="0"
          left="0"
          right="0"
          bottom="0"
          bg="rgba(0, 0, 0, 0.5)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={1000}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateDialog(false);
            }
          }}
        >
          <Box
            bg="white"
            p={6}
            borderRadius="md"
            maxWidth="500px"
            width="90%"
            onClick={(e) => e.stopPropagation()}
          >
            <Heading size="md" mb={4}>创建新项目</Heading>
            <form onSubmit={handleCreateProject}>
              <VStack spacing={4}>
                <Box mb={4}>
                  <Text mb={2} fontWeight="medium">项目名称</Text>
                  <Input
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="输入项目名称"
                    size="lg"
                  />
                </Box>
                
                <Box mb={4}>
                  <Text mb={2} fontWeight="medium">项目描述</Text>
                  <Textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    placeholder="简要描述您的小说项目（可选）"
                    rows={3}
                    resize="none"
                  />
                </Box>
                
                <HStack w="full" justify="flex-end" spacing={3} pt={4}>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    bg="blue.600"
                    color="white"
                    _hover={{ bg: "blue.700" }}
                    isDisabled={!newProjectName.trim()}
                  >
                    创建项目
                  </Button>
                </HStack>
              </VStack>
            </form>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ProjectDashboard;