import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Flex, 
  Button, 
  Heading, 
  Text, 
  HStack, 
  VStack,
  Select,
  Textarea,
  Icon,
  Spinner,
  Field
} from '@chakra-ui/react';
import { FaRobot, FaFont, FaSave, FaUpload, FaBook, FaPlus, FaLockOpen, FaLayerGroup, FaSpinner as FaSpinnerIcon, FaMagic, FaLightbulb, FaUsers } from 'react-icons/fa';
import { useNotification } from '../NotificationManager';
import { getChapters, updateChapter, publishChapter, createChapter, getChapter, batchUpdateChapterStatus, batchPublishChapters } from '../../services/chapterService';
import { aiService } from '../../services/aiService';
import BatchChapterPublishDialog from '../BatchChapterPublishDialog';
import './WritingEditorSimple.css';

const WritingEditor = ({ projectId, initialChapterId, onChapterChange, onProjectsChange }) => {
  const [aiAssisted, setAiAssisted] = useState(false);
  const [aiMode, setAiMode] = useState('optimize'); // 'optimize' or 'takeover'
  const [content, setContent] = useState('');
  const [currentChapter, setCurrentChapter] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isEditorLocked, setIsEditorLocked] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [showBatchPublish, setShowBatchPublish] = useState(false);
  const [publishButtonPosition, setPublishButtonPosition] = useState(null);
  const { addNotification, showConfirmDialog } = useNotification();

  // 当 currentChapter 改变时，也更新 content 和锁定状态
  useEffect(() => {
    if (currentChapter) {
      setContent(currentChapter.content || '');
      setIsEditorLocked(currentChapter.status === 'published');
    } else {
      setContent('');
      setIsEditorLocked(false);
    }
  }, [currentChapter]);

  // 获取项目章节数据
  useEffect(() => {
    if (projectId) {
      fetchChapters();
    }
  }, [projectId]);

  const fetchChapters = async () => {
    try {
      console.log('Fetching chapters for projectId:', projectId);
      const chaptersData = await getChapters(projectId);
      console.log('Received chapters data:', chaptersData);
      setChapters(chaptersData);

      let chapterToSet = null;

      // 1. 优先从 initialChapterId 加载
      if (initialChapterId) {
        chapterToSet = chaptersData.find(ch => ch.id === initialChapterId);
      }

      // 2. 如果没有，则使用默认逻辑
      if (!chapterToSet) {
        const lastPublished = chaptersData
          .filter(chapter => chapter.status === 'published')
          .sort((a, b) => b.chapter_number - a.chapter_number)[0];
        
        if (lastPublished) {
          const nextChapterNumber = lastPublished.chapter_number + 1;
          const nextChapter = chaptersData.find(ch => ch.chapter_number === nextChapterNumber);
          if (nextChapter) {
            chapterToSet = nextChapter;
          } else {
            // 如果没有下一章，就显示最后一章（已发布的章节）
            chapterToSet = lastPublished;
          }
        } else if (chaptersData.length > 0) {
          // 如果没有已发布章节，选择第一个草稿章节
          const draftChapters = chaptersData.filter(ch => ch.status === 'draft');
          chapterToSet = draftChapters.length > 0 ? draftChapters[0] : chaptersData[0];
        } else {
          // 如果没有任何章节，创建一个默认的
          chapterToSet = { id: null, title: '第一章', chapter_number: 1, status: 'draft' };
        }
      }
      
      console.log('Setting current chapter:', chapterToSet);
      setCurrentChapter(chapterToSet);

    } catch (error) {
      console.error('Error fetching chapters:', error);
      addNotification({
        message: '获取章节列表失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
    }
  };

  // 保存功能
  const saveContent = useCallback(async () => {
    if (isSaving || !currentChapter) return;
    
    setIsSaving(true);
    try {
      // 调用后端API保存内容
      const chapterData = {
        content: content,
        title: currentChapter.title,
        outline: currentChapter.outline || '',
        order_index: currentChapter.order_index,
        status: currentChapter.status
      };
      
      const updatedChapter = await updateChapter(currentChapter.id, chapterData);
      
      // 使用全局通知组件显示保存成功的通知
      addNotification({
        message: '内容已保存',
        type: 'success',
        duration: 3000
      });
      
      // 更新当前章节数据
      setCurrentChapter(updatedChapter);
      
      // 更新章节列表中的对应章节
      setChapters(prevChapters => 
        prevChapters.map(chapter => 
          chapter.id === updatedChapter.id ? updatedChapter : chapter
        )
      );
    } catch (error) {
      addNotification({
        message: '保存失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, content, currentChapter, addNotification]);

  // 发布功能
  const publishChapterContent = useCallback(async () => {
    if (isPublishing || !currentChapter) return;
    
    setIsPublishing(true);
    try {
      // 先保存当前内容
      const chapterData = {
        content: content,
        title: currentChapter.title,
        outline: currentChapter.outline || '',
        order_index: currentChapter.order_index,
        status: 'published'
      };
      
      const updatedChapter = await updateChapter(currentChapter.id, chapterData);
      
      // 使用全局通知组件显示发布成功的通知
      addNotification({
        message: '章节已发布',
        type: 'success',
        duration: 3000
      });
      
      // 重新获取最新的章节数据以确保状态同步
      const latestChapters = await getChapters(projectId);
      setChapters(latestChapters);
      
      // 重新获取当前章节的最新状态
      const latestChapter = await getChapter(currentChapter.id);
      setCurrentChapter(latestChapter);
      
      // 通知父组件更新项目状态
      if (onProjectsChange) {
        onProjectsChange();
      }
    } catch (error) {
      addNotification({
        message: '发布失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
    } finally {
      setIsPublishing(false);
    }
  }, [isPublishing, content, currentChapter, addNotification, projectId, onProjectsChange]);

  // Ctrl+S 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveContent();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [saveContent]);

  const handleContentChange = (newContent) => {
    setContent(newContent);
  };

  const toggleAiAssisted = () => {
    setAiAssisted(!aiAssisted);
  };

  const handleAiModeChange = (mode) => {
    setAiMode(mode);
  };

  const handleChapterChange = async (e) => {
    const selectedId = e.target.value;
    if (selectedId) {
      try {
        const chapterId = parseInt(selectedId);
        const chapterDetails = await getChapter(chapterId);
        setCurrentChapter(chapterDetails);
        if (onChapterChange) {
          onChapterChange(chapterDetails.id);
        }
      } catch (error) {
        addNotification({
          message: '获取章节详情失败: ' + error.message,
          type: 'error',
          duration: 3000
        });
      }
    }
  };

  const handleUnlockClick = () => {
    if (!currentChapter || !projectId) return;

    showConfirmDialog({
      title: '确认解锁章节',
      message: `您确定要解锁章节 "${currentChapter.title}" 吗？这将导致该章节及其之后的所有已发布章节状态变更为"草稿"，以便您可以重新编辑。`,
      type: 'warning',
      showResultNotification: true,
      successMessage: '章节已成功解锁，您可以开始编辑了',
      errorMessage: '解锁失败',
      onConfirm: async () => {
        try {
            await batchUpdateChapterStatus({
              project_id: projectId,
              from_order_index: currentChapter.chapter_number,
              new_status: 'draft'
            });
            
            await fetchChapters(); // Re-fetch all chapters to update list statuses
            
            // Re-fetch current chapter to get its updated status and unlock the editor
            const reloadedChapter = await getChapter(currentChapter.id);
            setCurrentChapter(reloadedChapter);

            if (onProjectsChange) {
              onProjectsChange();
            }
        } catch (error) {
          // The component will show the generic errorMessage.
          // Throwing the original error is good for debugging in the console.
          throw new Error(`解锁失败: ${error.message}`);
        }
      }
    });
  };

  // 开启新章
  const handleStartNewChapter = async (title) => {
    if (!title.trim() || !projectId) return;
    
    const newChapterData = {
      title: title,
      content: '',
      outline: '',
      status: 'draft'
    };
    
    const newChapter = await createChapter(projectId, newChapterData);
    
    setChapters(prev => [...prev, newChapter].sort((a, b) => a.chapter_number - b.chapter_number));
    setCurrentChapter(newChapter);
    setNewChapterTitle('');

    if (onProjectsChange) {
      onProjectsChange();
    }
  };

  // 处理批量发布
  const handleBatchPublish = async (chaptersToPublish, onProgress) => {
    try {
      const chapterIds = chaptersToPublish.map(ch => ch.id);
      const results = await batchPublishChapters(projectId, chapterIds, onProgress);
      
      // 刷新章节列表
      await fetchChapters();
      
      // 如果当前章节在发布的章节中，更新其状态
      const publishedChapterIds = results.results
        .filter(r => r.success)
        .map(r => r.chapterId);
      
      if (currentChapter && publishedChapterIds.includes(currentChapter.id)) {
        const updatedChapter = await getChapter(currentChapter.id);
        setCurrentChapter(updatedChapter);
      }
      
      // 通知父组件更新项目状态
      if (onProjectsChange) {
        onProjectsChange();
      }
      
      // 显示结果通知
      if (results.errorCount === 0) {
        addNotification({
          message: `成功发布 ${results.successCount} 个章节`,
          type: 'success',
          duration: 3000
        });
      } else {
        addNotification({
          message: `发布完成：成功 ${results.successCount} 个，失败 ${results.errorCount} 个`,
          type: 'warning',
          duration: 5000
        });
      }
      
    } catch (error) {
      addNotification({
        message: '批量发布失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
      throw error;
    }
  };

  // 打开批量发布对话框
  const handleBatchPublishClick = (event) => {
    const rect = event.target.getBoundingClientRect();
    setPublishButtonPosition({
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
      width: rect.width,
      height: rect.height
    });
    setShowBatchPublish(true);
  };

  const getChapterDisplay = () => {
    return currentChapter ? currentChapter.title : '未选择章节';
  };

  // 错误边界检查
  if (!projectId) {
    return (
      <Box p={8} textAlign="center" bg="white" _dark={{ bg: "gray.800" }} borderRadius="lg">
        <VStack spacing={4}>
          <Heading size="lg" color="text.primary">错误</Heading>
          <Text color="text.muted">项目ID未提供，请返回项目选择页面。</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box h="100vh" display="flex" flexDirection="column" bg="bg.canvas">
      {/* 主编辑区域 */}
      <Box flex="1" overflow="hidden">
        {chapters.length === 0 ? (
          <Box 
            p={12} 
            textAlign="center"
            bg="white" 
            _dark={{ bg: "gray.800" }}
            borderRadius="lg"
            m={4}
          >
            <VStack spacing={6}>
              <Heading size="lg" color="text.primary">欢迎开始创作！</Heading>
              <Text color="text.muted">您的项目目前还没有章节。</Text>
              <Button
                leftIcon={<FaBook />}
                colorScheme="brand"
                size="lg"
                onClick={() => {
                  showConfirmDialog({
                    title: '创建第一个章节',
                    message: '请输入章节标题：',
                    showInput: true,
                    inputValue: '',
                    onInputChange: (value) => {},
                    inputPlaceholder: '例如：第一章：开始',
                    required: true,
                    type: 'info',
                    showResultNotification: true,
                    successMessage: '第一个章节已创建',
                    errorMessage: '创建第一个章节失败',
                    onConfirm: handleStartNewChapter
                  });
                }}
              >
                创建第一个章节
              </Button>
            </VStack>
          </Box>
        ) : aiAssisted ? (
          <AiWritingInterface 
            content={content} 
            onContentChange={handleContentChange} 
            readOnly={isEditorLocked}
            projectId={projectId}
            currentChapter={currentChapter}
          />
        ) : (
          <RichTextEditor 
            content={content} 
            onContentChange={handleContentChange} 
            readOnly={isEditorLocked}
          />
        )}
      </Box>
      
      {/* 底部工具栏 */}
      <Box 
        bg="white" 
        _dark={{ bg: "gray.800" }}
        borderTop="1px" 
        borderColor="border.default"
        p={4}
      >
        <Flex justify="space-between" align="center" gap={4}>
          {/* 左侧控制区 */}
          <HStack spacing={4} flex="1">
            <VStack align="start" spacing={2}>
              <Text fontSize="sm" color="text.muted">当前章节</Text>
              <HStack spacing={2}>
                <Select 
                  value={currentChapter?.id || ''} 
                  onChange={handleChapterChange}
                  size="sm"
                  w="200px"
                >
                  {chapters.map(chapter => (
                    <option key={chapter.id} value={chapter.id}>
                      第{chapter.chapter_number}章 {chapter.title} ({chapter.status === 'published' ? '已发布' : '草稿'})
                    </option>
                  ))}
                </Select>
                {currentChapter && (
                  <Text 
                    fontSize="xs" 
                    px={2} 
                    py={1} 
                    borderRadius="md"
                    bg={currentChapter.status === 'published' ? 'green.100' : 'gray.100'}
                    color={currentChapter.status === 'published' ? 'green.800' : 'gray.800'}
                  >
                    {currentChapter.status === 'published' ? '已发布' : '草稿'}
                  </Text>
                )}
              </HStack>
            </VStack>
            
            <HStack spacing={2}>
              <Button
                size="sm"
                variant="outline"
                onClick={publishChapterContent}
                isDisabled={isPublishing || !currentChapter || currentChapter.status === 'published'}
                title={currentChapter?.status === 'published' ? "章节已发布" : "发布章节"}
              >
                <Icon as={FaUpload} />
                <Text ml={2}>
                  {currentChapter?.status === 'published' ? '已发布' : (isPublishing ? '发布中...' : '发布')}
                </Text>
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={handleBatchPublishClick}
                isDisabled={!currentChapter}
                title="批量发布多个章节"
              >
                <Icon as={FaLayerGroup} />
                <Text ml={2}>批量发布</Text>
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  showConfirmDialog({
                    title: '开启新章节',
                    message: '请输入新章节的标题：',
                    showInput: true,
                    inputValue: newChapterTitle,
                    onInputChange: (value) => setNewChapterTitle(value),
                    inputPlaceholder: '例如：新的征程',
                    required: true,
                    type: 'info',
                    showResultNotification: true,
                    successMessage: '新章节已开启',
                    errorMessage: '开启新章失败',
                    onConfirm: handleStartNewChapter
                  });
                }}
                title="开启一个全新的章节"
              >
                <Icon as={FaPlus} />
                <Text ml={2}>开启新章</Text>
              </Button>
              
              {isEditorLocked && (
                <Button
                  size="sm"
                  variant="outline"
                  colorScheme="orange"
                  onClick={handleUnlockClick}
                  title="解锁"
                >
                  <Icon as={FaLockOpen} />
                </Button>
              )}
            </HStack>
          </HStack>
          
          {/* 右侧控制区 */}
          <HStack spacing={4}>
            {aiAssisted && (
              <VStack align="start" spacing={2}>
                <Text fontSize="sm" color="text.muted">AI模式</Text>
                <HStack spacing={1}>
                  <Button
                    size="sm"
                    variant={aiMode === 'optimize' ? 'solid' : 'outline'}
                    colorScheme="brand"
                    onClick={() => handleAiModeChange('optimize')}
                  >
                    辅助优化型
                  </Button>
                  <Button
                    size="sm"
                    variant={aiMode === 'takeover' ? 'solid' : 'outline'}
                    colorScheme="brand"
                    onClick={() => handleAiModeChange('takeover')}
                  >
                    全面接管型
                  </Button>
                </HStack>
              </VStack>
            )}
            
            <HStack spacing={2}>
              <Button
                size="sm"
                variant="outline"
                onClick={saveContent}
                isDisabled={isSaving}
                title="保存内容 (Ctrl+S)"
              >
                <Icon as={FaSave} />
                <Text ml={2}>{isSaving ? '保存中...' : '保存'}</Text>
              </Button>
              
              <Button
                size="sm"
                variant={aiAssisted ? 'solid' : 'outline'}
                colorScheme="brand"
                onClick={toggleAiAssisted}
                title={aiAssisted ? "关闭AI辅助" : "开启AI辅助"}
              >
                <Icon as={aiAssisted ? FaRobot : FaFont} />
                <Text ml={2}>{aiAssisted ? "AI辅助中" : "AI辅助"}</Text>
              </Button>
            </HStack>
          </HStack>
        </Flex>
      </Box>

      {/* 批量发布对话框 */}
      {showBatchPublish && (
        <BatchChapterPublishDialog
          projectId={projectId}
          currentChapter={currentChapter}
          chapters={chapters}
          onClose={() => setShowBatchPublish(false)}
          onPublish={handleBatchPublish}
          triggerPosition={publishButtonPosition}
        />
      )}
    </Box>
  );
};


const RichTextEditor = ({ content, onContentChange, readOnly }) => {
  const handleChange = (e) => {
    if (!readOnly) {
      onContentChange(e.target.value);
    }
  };

  return (
    <Box position="relative" h="100%" bg="white" _dark={{ bg: "gray.800" }}>
      {readOnly && (
        <Box 
          position="absolute" 
          top="0" 
          left="0" 
          right="0" 
          bottom="0" 
          bg="rgba(0, 0, 0, 0.1)" 
          display="flex" 
          alignItems="center" 
          justifyContent="center"
          zIndex={10}
        >
          <Text color="text.muted">编辑区已锁定</Text>
        </Box>
      )}
      <Textarea
        h="100%"
        p={4}
        border="none"
        resize="none"
        focusBorderColor="transparent"
        value={content}
        onChange={handleChange}
        placeholder="在这里开始你的创作..."
        readOnly={readOnly}
        fontSize="md"
        lineHeight="1.6"
      />
    </Box>
  );
};

const AiWritingInterface = ({ content, onContentChange, readOnly, projectId, currentChapter }) => {
  const [messages, setMessages] = useState([
    { id: 1, role: 'assistant', content: '你好！我是你的AI写作助手。我可以帮助你进行创意构思、内容优化、情节建议等。有什么需要帮助的吗？' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleContentChange = (e) => {
    onContentChange(e.target.value);
  };

  const handleSend = async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage = { id: messages.length + 1, role: 'user', content: input };
    setMessages([...messages, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await aiService.chatWithAI(projectId, input, messages);
      const aiResponse = { 
        id: messages.length + 2, 
        role: 'assistant', 
        content: response.content || response.response || '抱歉，我暂时无法回复。'
      };
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      const errorMessage = { 
        id: messages.length + 2, 
        role: 'assistant', 
        content: `抱歉，AI服务暂时不可用: ${error.message}`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAIAction = async (action) => {
    if (!currentChapter || isLoading) return;

    setIsLoading(true);
    try {
      let response;
      switch (action) {
        case 'outline':
          response = await aiService.generateChapterOutline(projectId, {
            title: currentChapter.title,
            current_content: content,
            chapter_number: currentChapter.chapter_number
          });
          break;
        case 'suggestions':
          response = await aiService.getPlotSuggestions(projectId, {
            title: currentChapter.title,
            content: content
          });
          break;
        case 'optimize':
          response = await aiService.optimizeContent(projectId, content);
          if (response.optimized_content) {
            onContentChange(response.optimized_content);
          }
          break;
        case 'ideas':
          response = await aiService.generateCreativeIdeas(projectId, '请为当前章节提供一些创意建议');
          break;
        default:
          return;
      }

      const aiResponse = { 
        id: messages.length + 1, 
        role: 'assistant', 
        content: response.content || response.suggestions || response.optimized_content || '操作完成'
      };
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      const errorMessage = { 
        id: messages.length + 1, 
        role: 'assistant', 
        content: `${action} 操作失败: ${error.message}`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box h="100%" display="flex" flexDirection="column" bg="bg.canvas">
      {/* AI工具栏 */}
      <Box 
        bg="white" 
        _dark={{ bg: "gray.800" }}
        borderBottom="1px" 
        borderColor="border.default"
        p={2}
      >
        <HStack spacing={2}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAIAction('outline')}
            isDisabled={isLoading}
            title="生成章节大纲"
          >
            <Icon as={FaMagic} />
            <Text ml={1}>大纲</Text>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAIAction('suggestions')}
            isDisabled={isLoading}
            title="获取情节建议"
          >
            <Icon as={FaLightbulb} />
            <Text ml={1}>建议</Text>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAIAction('optimize')}
            isDisabled={isLoading}
            title="优化当前内容"
          >
            <Icon as={FaSpinnerIcon} />
            <Text ml={1}>优化</Text>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAIAction('ideas')}
            isDisabled={isLoading}
            title="生成创意想法"
          >
            <Icon as={FaUsers} />
            <Text ml={1}>创意</Text>
          </Button>
        </HStack>
      </Box>
      
      <Flex flex="1" overflow="hidden">
        {/* 聊天区域 */}
        <Box 
          w="400px" 
          borderRight="1px" 
          borderColor="border.default"
          display="flex" 
          flexDirection="column"
        >
          <Box flex="1" overflow="auto" p={4}>
            <VStack spacing={3} align="stretch">
              {messages.map((message) => (
                <Box
                  key={message.id}
                  p={3}
                  borderRadius="md"
                  bg={message.role === 'user' ? 'brand.50' : 'gray.50'}
                  _dark={{ bg: message.role === 'user' ? 'brand.900' : 'gray.900' }}
                  alignSelf={message.role === 'user' ? 'flex-end' : 'flex-start'}
                  maxW="80%"
                >
                  <Text fontSize="sm" color="text.primary">
                    {message.content}
                  </Text>
                </Box>
              ))}
              {isLoading && (
                <Box
                  p={3}
                  borderRadius="md"
                  bg="gray.50"
                  _dark={{ bg: "gray.900" }}
                  alignSelf="flex-start"
                  maxW="80%"
                >
                  <HStack spacing={2}>
                    <Spinner size="sm" />
                    <Text fontSize="sm" color="text.muted">AI正在思考中...</Text>
                  </HStack>
                </Box>
              )}
            </VStack>
          </Box>
          
          <Box 
            p={3} 
            borderTop="1px" 
            borderColor="border.default"
            bg="white" 
            _dark={{ bg: "gray.800" }}
          >
            <HStack spacing={2}>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="与AI助手对话，获取写作建议..."
                rows={2}
                isDisabled={isLoading}
                resize="none"
                fontSize="sm"
              />
              <Button
                colorScheme="brand"
                onClick={handleSend}
                isDisabled={isLoading || input.trim() === ''}
                size="sm"
                alignSelf="flex-end"
              >
                {isLoading ? <Spinner size="sm" /> : '发送'}
              </Button>
            </HStack>
          </Box>
        </Box>
        
        {/* 内容编辑区域 */}
        <Box flex="1" position="relative">
          {readOnly && (
            <Box 
              position="absolute" 
              top="0" 
              left="0" 
              right="0" 
              bottom="0" 
              bg="rgba(0, 0, 0, 0.1)" 
              display="flex" 
              alignItems="center" 
              justifyContent="center"
              zIndex={10}
            >
              <Text color="text.muted">编辑区已锁定</Text>
            </Box>
          )}
          <Textarea
            h="100%"
            p={4}
            border="none"
            resize="none"
            focusBorderColor="transparent"
            value={content}
            onChange={handleContentChange}
            placeholder="在这里创作你的小说内容..."
            readOnly={readOnly}
            fontSize="md"
            lineHeight="1.6"
          />
        </Box>
      </Flex>
    </Box>
  );
};

export default WritingEditor;