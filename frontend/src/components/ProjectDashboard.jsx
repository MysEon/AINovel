import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Flex, 
  Heading, 
  Text, 
  Button, 
  Card, 
  CardHeader, 
  CardBody, 
  CardFooter,
  Grid, 
  GridItem,
  Avatar,
      Input,
  Textarea,
  Stack,
  HStack,
  VStack,
  Icon
} from '@chakra-ui/react';
import { Field } from '@chakra-ui/react';
import { 
  FaPlus, 
  FaBook, 
  FaEdit, 
  FaTrash, 
  FaCalendarAlt, 
  FaFileAlt,
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

  return (
    <Box 
      minH="100vh" 
      bg="bg.canvas"
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
              color="text.primary" 
              mb={1}
            >
              我的项目
            </Heading>
            <Text 
              color="text.secondary" 
              fontSize="lg"
            >
              欢迎回来，{user?.name || '用户'}
            </Text>
          </Box>
          
          <HStack spacing={4}>
            <Button
              leftIcon={<FaPlus />}
              colorScheme="brand"
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
              bg="brand.50"
              _dark={{ bg: "brand.900" }}
              borderRadius="full"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Icon as={FaBook} fontSize="3xl" color="brand.500" />
            </Box>
            
            <VStack spacing={2}>
              <Heading size="md" color="text.primary">
                还没有项目
              </Heading>
              <Text color="text.muted">
                创建您的第一个小说项目，开始创作之旅
              </Text>
            </VStack>
            
            <Button
              leftIcon={<FaPlus />}
              colorScheme="brand"
              onClick={() => setShowCreateDialog(true)}
              size="lg"
            >
              创建项目
            </Button>
          </VStack>
        </Box>
      ) : (
        <Grid 
          templateColumns="repeat(auto-fill, minmax(350px, 1fr))" 
          gap={6}
        >
          {projects.map(project => {
            const stats = getProjectStats(project);
            return (
              <Card 
                key={project.id} 
                bg="white" 
                _dark={{ bg: "gray.800" }}
                borderRadius="lg" 
                boxShadow="sm"
                _hover={{ boxShadow: "md" }}
                transition="all 0.2s"
              >
                <CardHeader pb={3}>
                  <Flex justify="space-between" align="start">
                    <Heading size="md" color="text.primary" noOfLines={2}>
                      {project.name}
                    </Heading>
                    
                    <HStack spacing={1}>
                      <Button
                        size="sm"
                        variant="ghost"
                        colorScheme="brand"
                        onClick={() => onSelectProject(project.id)}
                        title="编辑项目"
                      >
                        <FaEdit />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => handleDeleteProject(project)}
                        title="删除项目"
                      >
                        <FaTrash />
                      </Button>
                    </HStack>
                  </Flex>
                  
                  {project.description && (
                    <Text 
                      color="text.secondary" 
                      fontSize="sm" 
                      noOfLines={2}
                      mt={2}
                    >
                      {project.description}
                    </Text>
                  )}
                </CardHeader>
                
                <CardBody py={3}>
                  <HStack spacing={4}>
                    <VStack align="start" spacing={1}>
                      <Text fontSize="xs" color="text.muted" fontWeight="medium">
                        字数
                      </Text>
                      <Text fontSize="lg" fontWeight="bold" color="brand.600">
                        {stats.wordCount.toLocaleString()}
                      </Text>
                    </VStack>
                    
                    <VStack align="start" spacing={1}>
                      <Text fontSize="xs" color="text.muted" fontWeight="medium">
                        章节
                      </Text>
                      <Text fontSize="lg" fontWeight="bold" color="creative.600">
                        {stats.chapters}
                      </Text>
                    </VStack>
                  </HStack>
                </CardBody>
                
                <CardFooter pt={3}>
                  <VStack w="full" spacing={3} align="stretch">
                    <Box borderBottom="1px solid" borderColor="gray.200" my={2} />
                    
                    <HStack justify="space-between" align="center">
                      <HStack spacing={2} color="text.muted">
                        <Icon as={FaCalendarAlt} fontSize="sm" />
                        <Text fontSize="sm">
                          更新于 {formatDate(stats.lastUpdated)}
                        </Text>
                      </HStack>
                      
                      <Button
                        size="sm"
                        colorScheme="brand"
                        onClick={() => onSelectProject(project.id)}
                        leftIcon={<FaFileAlt />}
                      >
                        打开项目
                      </Button>
                    </HStack>
                  </VStack>
                </CardFooter>
              </Card>
            );
          })}
        </Grid>
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
                <Field.Root required>
                  <Field.Label>项目名称</Field.Label>
                  <Input
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="输入项目名称"
                    size="lg"
                  />
                </Field.Root>
                
                <Field.Root>
                  <Field.Label>项目描述</Field.Label>
                  <Textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    placeholder="简要描述您的小说项目（可选）"
                    rows={3}
                    resize="none"
                  />
                </Field.Root>
                
                <HStack w="full" justify="flex-end" spacing={3} pt={4}>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    bg="brand.600"
                    color="white"
                    _hover={{ bg: "brand.700" }}
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