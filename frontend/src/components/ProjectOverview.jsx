import React, { useState, useEffect } from 'react';
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
import { FaBook, FaList, FaEye, FaDownload, FaPrint } from 'react-icons/fa';
import { getChapters } from '../services/chapterService';
import { useNotification } from './NotificationManager';
import './ProjectOverview.css';

const ProjectOverview = ({ project, onNavigateToDrafts }) => {
  const [activeTab, setActiveTab] = useState('content');
  const [readingMode, setReadingMode] = useState(false);
  const [publishedChapters, setPublishedChapters] = useState([]);
  const [loading, setLoading] = useState(false);
  const { addNotification, showConfirmDialog } = useNotification();

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

  const handlePreviewChapter = (chapter) => {
    showConfirmDialog({
      title: `第${chapter.chapter_number}章 ${chapter.title}`,
      message: chapter.content,
      type: 'info',
      showCancel: false,
      confirmText: '关闭',
      className: 'chapter-preview',
      customContent: (
        <div className="chapter-detail-content">
          <div className="chapter-meta-info">
            <span className="word-count">{chapter.word_count || 0} 字</span>
            <span className="publish-date">
              发布于 {new Date(chapter.updated_at).toLocaleDateString()}
            </span>
          </div>
          <div className="chapter-text-content">
            {chapter.content}
          </div>
        </div>
      )
    });
  };

  if (readingMode) {
    return (
      <Box h="100vh" bg="white" _dark={{ bg: "gray.800" }}>
        <Box 
          bg="white" 
          _dark={{ bg: "gray.800" }}
          borderBottom="1px" 
          borderColor="border.default"
          p={4}
        >
          <Flex justify="space-between" align="center">
            <Heading size="lg" color="text.primary">{project.name}</Heading>
            <Button 
              variant="outline" 
              onClick={() => setReadingMode(false)}
            >
              退出阅读模式
            </Button>
          </Flex>
        </Box>
        <Box p={8} overflow="auto">
          <VStack spacing={8} align="stretch">
            {publishedChapters.map((chapter) => (
              <Box key={chapter.id}>
                <Heading size="md" color="text.primary" mb={4}>
                  第{chapter.chapter_number}章 {chapter.title}
                </Heading>
                <Text color="text.secondary" lineHeight="1.8">
                  {chapter.content}
                </Text>
              </Box>
            ))}
          </VStack>
        </Box>
      </Box>
    );
  }

  return (
    <Box h="100vh" display="flex" flexDirection="column" bg="bg.canvas" p={6}>
      {/* 头部 */}
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
              {project.name} - 项目总览
            </Heading>
          </Box>
          
          <HStack spacing={3}>
            <Button
              leftIcon={<FaBook />}
              colorScheme="brand"
              onClick={onNavigateToDrafts}
              size="md"
            >
              开始编写
            </Button>
            <Button
              leftIcon={<FaEye />}
              variant="outline"
              onClick={() => setReadingMode(true)}
              isDisabled={publishedChapters.length === 0}
              size="md"
            >
              阅读模式
            </Button>
            <Button
              leftIcon={<FaDownload />}
              variant="outline"
              onClick={() => handleExport('PDF')}
              isDisabled={publishedChapters.length === 0}
              size="md"
            >
              导出PDF
            </Button>
            <Button
              leftIcon={<FaPrint />}
              variant="outline"
              onClick={handlePrint}
              isDisabled={publishedChapters.length === 0}
              size="md"
            >
              打印
            </Button>
          </HStack>
        </Flex>
      </Box>

      {/* 空项目状态 */}
      {publishedChapters.length === 0 && !loading && (
        <Box 
          bg="white" 
          _dark={{ bg: "gray.800" }}
          borderRadius="lg" 
          p={12} 
          textAlign="center"
          mb={6}
        >
          <VStack spacing={6}>
            <Heading size="lg" color="text.primary">
              欢迎使用AINovel创作平台！
            </Heading>
            <Text color="text.muted">
              您的项目目前还没有已发布的章节。
            </Text>
            <Button
              leftIcon={<FaBook />}
              colorScheme="brand"
              onClick={onNavigateToDrafts}
              size="lg"
            >
              立即开始创作
            </Button>
          </VStack>
        </Box>
      )}

      {/* 统计卡片 */}
      <HStack spacing={6} mb={6}>
        <Box 
          bg="white" 
          _dark={{ bg: "gray.800" }}
          borderRadius="lg" 
          p={6} 
          flex="1"
          boxShadow="sm"
        >
          <HStack spacing={4} align="center">
            <Box 
              w="12" 
              h="12" 
              bg="brand.50" 
              _dark={{ bg: "brand.900" }}
              borderRadius="full" 
              display="flex" 
              alignItems="center" 
              justifyContent="center"
            >
              <Icon as={FaBook} fontSize="xl" color="brand.500" />
            </Box>
            <VStack align="start" spacing={0}>
              <Heading size="lg" color="text.primary">{publishedChapters.length}</Heading>
              <Text color="text.muted">已发布章节数</Text>
            </VStack>
          </HStack>
        </Box>
        
        <Box 
          bg="white" 
          _dark={{ bg: "gray.800" }}
          borderRadius="lg" 
          p={6} 
          flex="1"
          boxShadow="sm"
        >
          <HStack spacing={4} align="center">
            <Box 
              w="12" 
              h="12" 
              bg="creative.50" 
              _dark={{ bg: "creative.900" }}
              borderRadius="full" 
              display="flex" 
              alignItems="center" 
              justifyContent="center"
            >
              <Icon as={FaList} fontSize="xl" color="creative.500" />
            </Box>
            <VStack align="start" spacing={0}>
              <Heading size="lg" color="text.primary">{totalWordCount.toLocaleString()}</Heading>
              <Text color="text.muted">已发布总字数</Text>
            </VStack>
          </HStack>
        </Box>
      </HStack>

      {/* 内容区域 */}
      <Box 
        bg="white" 
        _dark={{ bg: "gray.800" }}
        borderRadius="lg" 
        boxShadow="sm" 
        flex="1"
        overflow="hidden"
        display="flex" 
        flexDirection="column"
      >
        {/* 自定义标签页 */}
        <Box borderBottom="1px" borderColor="border.default">
          <HStack spacing={0}>
            <Button
              variant={activeTab === 'content' ? 'solid' : 'ghost'}
              colorScheme="brand"
              onClick={() => setActiveTab('content')}
              borderRadius="none"
              borderBottomWidth={activeTab === 'content' ? '2px' : '0'}
              borderBottomColor={activeTab === 'content' ? 'brand.500' : 'transparent'}
            >
              内容结构
            </Button>
            <Button
              variant={activeTab === 'chapters' ? 'solid' : 'ghost'}
              colorScheme="brand"
              onClick={() => setActiveTab('chapters')}
              borderRadius="none"
              borderBottomWidth={activeTab === 'chapters' ? '2px' : '0'}
              borderBottomColor={activeTab === 'chapters' ? 'brand.500' : 'transparent'}
            >
              章节列表
            </Button>
          </HStack>
        </Box>

        {/* 标签页内容 */}
        <Box flex="1" overflow="auto">
          {activeTab === 'content' && (
            <Box p={6}>
              <VStack spacing={6} align="stretch">
                <Heading size="md" color="text.primary">项目结构</Heading>
                <VStack spacing={3} align="stretch">
                  <Box 
                    p={4} 
                    bg="gray.50" 
                    _dark={{ bg: "gray.900" }}
                    borderRadius="md"
                  >
                    <HStack spacing={2}>
                      <Icon as={FaBook} color="brand.500" />
                      <Text fontWeight="medium" color="text.primary">{project.name}</Text>
                    </HStack>
                  </Box>
                  
                  {publishedChapters.length > 0 ? (
                    <VStack spacing={2} align="stretch">
                      {publishedChapters.map((chapter) => (
                        <Box 
                          key={chapter.id} 
                          p={3} 
                          bg="gray.50" 
                          _dark={{ bg: "gray.900" }}
                          borderRadius="md"
                          ml={4}
                        >
                          <HStack spacing={2}>
                            <Icon as={FaList} color="creative.500" fontSize="sm" />
                            <Text color="text.primary">
                              第{chapter.chapter_number}章 {chapter.title} ({chapter.word_count || 0}字)
                            </Text>
                          </HStack>
                        </Box>
                      ))}
                    </VStack>
                  ) : (
                    <Box 
                      p={4} 
                      bg="gray.50" 
                      _dark={{ bg: "gray.900" }}
                      borderRadius="md"
                      ml={4}
                    >
                      <HStack spacing={2}>
                        <Icon as={FaList} color="gray.400" />
                        <Text color="text.muted">暂无已发布章节</Text>
                      </HStack>
                    </Box>
                  )}
                </VStack>
              </VStack>
            </Box>
          )}

          {activeTab === 'chapters' && (
            <Box p={6}>
              <VStack spacing={6} align="stretch">
                <Heading size="md" color="text.primary">已发布章节列表</Heading>
                <Box overflow="auto">
                  <VStack spacing={2} align="stretch">
                    {/* 表头 */}
                    <Box 
                      bg="gray.50" 
                      _dark={{ bg: "gray.900" }}
                      p={3} 
                      borderRadius="md"
                      display="grid" 
                      gridTemplateColumns="1fr 2fr 1fr 1fr"
                      gap={3}
                      alignItems="center"
                    >
                      <Text fontWeight="bold" color="text.primary" fontSize="sm">章节</Text>
                      <Text fontWeight="bold" color="text.primary" fontSize="sm">标题</Text>
                      <Text fontWeight="bold" color="text.primary" fontSize="sm" textAlign="right">字数</Text>
                      <Text fontWeight="bold" color="text.primary" fontSize="sm" textAlign="center">操作</Text>
                    </Box>
                    
                    {/* 表格内容 */}
                    {publishedChapters.map((chapter) => (
                      <Box 
                        key={chapter.id} 
                        bg="white" 
                        _dark={{ bg: "gray.800" }}
                        p={3} 
                        borderRadius="md"
                        border="1px" 
                        borderColor="border.default"
                        display="grid" 
                        gridTemplateColumns="1fr 2fr 1fr 1fr"
                        gap={3}
                        alignItems="center"
                      >
                        <Text color="text.primary" fontSize="sm">第{chapter.chapter_number}章</Text>
                        <Text color="text.primary" fontSize="sm">{chapter.title}</Text>
                        <Text color="text.primary" fontSize="sm" textAlign="right">{chapter.word_count || 0}</Text>
                        <Box display="flex" justifyContent="center">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handlePreviewChapter(chapter)}
                          >
                            预览
                          </Button>
                        </Box>
                      </Box>
                    ))}
                  </VStack>
                </Box>
              </VStack>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ProjectOverview;