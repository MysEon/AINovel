import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Flex, 
  Button, 
  Heading, 
  Text, 
  HStack, 
  VStack,
  Icon,
  Spinner,
  Grid,
  Badge,
  // Divider removed
  CloseButton
} from '@chakra-ui/react';
import { FaBrain, FaChartLine, FaMagic, FaLightbulb, FaUsers, FaSpinner as FaSpinnerIcon } from 'react-icons/fa';
import { aiService } from '../services/aiService';
import { useNotification } from './NotificationManager';
import './KnowledgeBase.css';

const KnowledgeBase = ({ projectId }) => {
  const [activeModule, setActiveModule] = useState('characters');
  const [knowledgeData, setKnowledgeData] = useState({});
  const [loading, setLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const { addNotification } = useNotification();

  // 四个知识库模块
  const modules = [
    {
      id: 'characters',
      name: '角色知识库',
      icon: '👥',
      description: '管理角色信息、关系图谱、对话风格',
      color: '#FF6B6B'
    },
    {
      id: 'worldviews',
      name: '世界观知识库',
      icon: '🌍',
      description: '构建世界观、魔法体系、时间线',
      color: '#4ECDC4'
    },
    {
      id: 'scenes',
      name: '场景知识库',
      icon: '🏞️',
      description: '场景管理、氛围标签、模板库',
      color: '#45B7D1'
    },
    {
      id: 'techniques',
      name: '创作技巧库',
      icon: '✍️',
      description: '写作技巧、灵感收集、案例分析',
      color: '#96CEB4'
    }
  ];

  useEffect(() => {
    if (projectId) {
      loadKnowledgeData();
    }
  }, [projectId, activeModule]);

  const loadKnowledgeData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('ainovel_token');
      if (!token) {
        throw new Error('请先登录');
      }

      const response = await fetch(`/api/knowledge/${activeModule}/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setKnowledgeData(prev => ({ ...prev, [activeModule]: data }));
      } else if (response.status === 401) {
        localStorage.removeItem('ainovel_token');
        throw new Error('登录已过期，请重新登录');
      } else {
        throw new Error('加载知识库数据失败');
      }
    } catch (error) {
      console.error('加载知识库数据失败:', error);
      addNotification({
        message: '加载知识库数据失败: ' + error.message,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const performAIAnalysis = async () => {
    if (!projectId) return;

    setAiAnalyzing(true);
    try {
      let analysisResult;
      switch (activeModule) {
        case 'characters':
          analysisResult = await aiService.analyzeCharacterRelationships(projectId);
          break;
        case 'worldviews':
          analysisResult = await aiService.checkWorldviewConsistency(projectId, '');
          break;
        case 'scenes':
          analysisResult = await aiService.generateCreativeIdeas(projectId, '分析场景知识库并提供改进建议');
          break;
        case 'techniques':
          analysisResult = await aiService.getWritingSuggestions(projectId, '', { type: 'techniques' });
          break;
        default:
          analysisResult = await aiService.analyzeKnowledgeBase(projectId, activeModule);
      }
      
      setAiAnalysis(analysisResult);
      addNotification({
        message: 'AI分析完成',
        type: 'success'
      });
    } catch (error) {
      addNotification({
        message: 'AI分析失败: ' + error.message,
        type: 'error'
      });
    } finally {
      setAiAnalyzing(false);
    }
  };

  const generateAIInsights = async () => {
    if (!projectId) return;

    setAiAnalyzing(true);
    try {
      const insights = await aiService.generateCreativeIdeas(projectId, `基于${activeModule}知识库提供创作建议`);
      setAiAnalysis(insights);
      addNotification({
        message: 'AI洞察生成完成',
        type: 'success'
      });
    } catch (error) {
      addNotification({
        message: 'AI洞察生成失败: ' + error.message,
        type: 'error'
      });
    } finally {
      setAiAnalyzing(false);
    }
  };

  const renderModuleContent = () => {
    switch (activeModule) {
      case 'characters':
        return <CharacterKnowledgeBase data={knowledgeData.characters || []} />;
      case 'worldviews':
        return <WorldviewKnowledgeBase data={knowledgeData.worldviews || []} />;
      case 'scenes':
        return <SceneKnowledgeBase data={knowledgeData.scenes || []} />;
      case 'techniques':
        return <WritingTechniqueKnowledgeBase data={knowledgeData.techniques || []} />;
      default:
        return <div>请选择一个知识库模块</div>;
    }
  };

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
        <VStack spacing={4} align="stretch">
          <Box>
            <Heading size="lg" color="text.primary" mb={2}>
              知识库
            </Heading>
            <Text color="text.muted">
              系统化管理您的创作素材和技巧
            </Text>
          </Box>
          
          <HStack spacing={3}>
            <Button
              leftIcon={aiAnalyzing ? <Spinner size="sm" /> : <Icon as={FaBrain} />}
              onClick={performAIAnalysis}
              isDisabled={aiAnalyzing || !projectId}
              colorScheme="brand"
              variant="outline"
            >
              {aiAnalyzing ? '分析中...' : 'AI分析'}
            </Button>
            <Button
              leftIcon={aiAnalyzing ? <Spinner size="sm" /> : <Icon as={FaLightbulb} />}
              onClick={generateAIInsights}
              isDisabled={aiAnalyzing || !projectId}
              colorScheme="brand"
              variant="outline"
            >
              {aiAnalyzing ? '生成中...' : 'AI洞察'}
            </Button>
          </HStack>
        </VStack>
      </Box>

      {/* 模块选择 */}
      <Grid templateColumns="repeat(2, 1fr)" gap={4} mb={6}>
        {modules.map(module => (
          <Box
            key={module.id}
            bg="white"
            _dark={{ bg: "gray.800" }}
            borderRadius="lg"
            p={4}
            cursor="pointer"
            border="2px"
            borderColor={activeModule === module.id ? 'brand.500' : 'transparent'}
            boxShadow="sm"
            transition="all 0.2s"
            _hover={{ shadow: "md" }}
            onClick={() => setActiveModule(module.id)}
          >
            <HStack spacing={3} align="start">
              <Text fontSize="2xl">{module.icon}</Text>
              <VStack align="start" spacing={1} flex="1">
                <Heading size="sm" color="text.primary">{module.name}</Heading>
                <Text fontSize="sm" color="text.muted">{module.description}</Text>
              </VStack>
              {activeModule === module.id && (
                <Box 
                  w="3" 
                  h="3" 
                  borderRadius="full" 
                  bg="brand.500"
                />
              )}
            </HStack>
          </Box>
        ))}
      </Grid>

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
        {loading ? (
          <Box flex="1" display="flex" alignItems="center" justifyContent="center">
            <VStack spacing={4}>
              <Spinner size="xl" color="brand.500" />
              <Text color="text.muted">加载中...</Text>
            </VStack>
          </Box>
        ) : (
          <Box flex="1" overflow="auto" p={6}>
            <VStack spacing={6} align="stretch">
              {aiAnalysis && (
                <Box 
                  bg="brand.50" 
                  _dark={{ bg: "brand.900", borderColor: "brand.700" }}
                  borderRadius="md" 
                  p={4}
                  border="1px"
                  borderColor="brand.200"
                >
                  <HStack justify="space-between" align="start" mb={3}>
                    <HStack spacing={2}>
                      <Icon as={FaBrain} color="brand.500" />
                      <Heading size="md" color="text.primary">AI分析结果</Heading>
                    </HStack>
                    <CloseButton 
                      size="sm"
                      onClick={() => setAiAnalysis(null)}
                    />
                  </HStack>
                  
                  <Box color="text.primary">
                    {typeof aiAnalysis === 'string' ? (
                      <Text>{aiAnalysis}</Text>
                    ) : (
                      <VStack spacing={4} align="stretch">
                        {aiAnalysis.content && (
                          <Text>{aiAnalysis.content}</Text>
                        )}
                        {aiAnalysis.suggestions && (
                          <Box>
                            <Heading size="sm" color="text.primary" mb={2}>建议:</Heading>
                            <VStack spacing={1} align="stretch" pl={4}>
                              {aiAnalysis.suggestions.map((suggestion, index) => (
                                <Text key={index} fontSize="sm" color="text.secondary">• {suggestion}</Text>
                              ))}
                            </VStack>
                          </Box>
                        )}
                        {aiAnalysis.insights && (
                          <Box>
                            <Heading size="sm" color="text.primary" mb={2}>洞察:</Heading>
                            <VStack spacing={1} align="stretch" pl={4}>
                              {aiAnalysis.insights.map((insight, index) => (
                                <Text key={index} fontSize="sm" color="text.secondary">• {insight}</Text>
                              ))}
                            </VStack>
                          </Box>
                        )}
                        {aiAnalysis.recommendations && (
                          <Box>
                            <Heading size="sm" color="text.primary" mb={2}>推荐:</Heading>
                            <VStack spacing={1} align="stretch" pl={4}>
                              {aiAnalysis.recommendations.map((recommendation, index) => (
                                <Text key={index} fontSize="sm" color="text.secondary">• {recommendation}</Text>
                              ))}
                            </VStack>
                          </Box>
                        )}
                      </VStack>
                    )}
                  </Box>
                </Box>
              )}
              
              {renderModuleContent()}
            </VStack>
          </Box>
        )}
      </Box>
    </Box>
  );
};

// 角色知识库总览组件
const CharacterKnowledgeBase = ({ data }) => (
  <Box>
    <HStack justify="space-between" align="center" mb={4}>
      <Heading size="md" color="text.primary">角色知识库</Heading>
      <Badge colorScheme="brand">{data.length} 个角色</Badge>
    </HStack>
    
    {data.length > 0 ? (
      <VStack spacing={3} align="stretch">
        <Grid templateColumns="repeat(2, 1fr)" gap={3}>
          {data.slice(0, 6).map(character => (
            <Box 
              key={character.id} 
              bg="gray.50" 
              _dark={{ bg: "gray.900" }}
              borderRadius="md" 
              p={3}
              border="1px"
              borderColor="border.default"
            >
              <HStack spacing={3} align="start">
                <Text fontSize="xl">👤</Text>
                <VStack align="start" spacing={1} flex="1">
                  <Heading size="sm" color="text.primary">{character.name}</Heading>
                  <Text fontSize="sm" color="text.muted">
                    {character.personality || '暂无性格描述'}
                  </Text>
                  <Badge 
                    variant="outline" 
                    fontSize="xs"
                    colorScheme="gray"
                  >
                    {character.dialogue_style || '对话风格未设置'}
                  </Badge>
                </VStack>
              </HStack>
            </Box>
          ))}
        </Grid>
        
        {data.length > 6 && (
          <Box 
            bg="gray.50" 
            _dark={{ bg: "gray.900" }}
            borderRadius="md" 
            p={3}
            textAlign="center"
          >
            <Text fontSize="sm" color="text.muted">
              +{data.length - 6} 个更多角色
            </Text>
          </Box>
        )}
      </VStack>
    ) : (
      <Box 
        bg="gray.50" 
        _dark={{ bg: "gray.900" }}
        borderRadius="md" 
        p={8} 
        textAlign="center"
      >
        <VStack spacing={3}>
          <Text fontSize="3xl">👥</Text>
          <Text color="text.muted">暂无角色数据</Text>
          <Text fontSize="sm" color="text.secondary">开始创建您的第一个角色</Text>
        </VStack>
      </Box>
    )}
  </Box>
);

// 世界观知识库总览组件
const WorldviewKnowledgeBase = ({ data }) => (
  <Box>
    <HStack justify="space-between" align="center" mb={4}>
      <Heading size="md" color="text.primary">世界观知识库</Heading>
      <Badge colorScheme="brand">{data.length} 个世界观</Badge>
    </HStack>
    
    {data.length > 0 ? (
      <VStack spacing={3} align="stretch">
        {data.slice(0, 4).map(worldview => (
          <Box 
            key={worldview.id} 
            bg="gray.50" 
            _dark={{ bg: "gray.900" }}
            borderRadius="md" 
            p={4}
            border="1px"
            borderColor="border.default"
          >
            <HStack spacing={3} align="start">
              <Text fontSize="2xl">🌍</Text>
              <VStack align="start" spacing={2} flex="1">
                <Heading size="sm" color="text.primary">{worldview.name}</Heading>
                <Text fontSize="sm" color="text.muted">
                  {worldview.description || '暂无描述'}
                </Text>
                <HStack spacing={2} flexWrap="wrap">
                  {worldview.magic_system && (
                    <Badge 
                      variant="outline" 
                      fontSize="xs"
                      colorScheme="purple"
                    >
                      魔法: {worldview.magic_system}
                    </Badge>
                  )}
                  {worldview.technology_level && (
                    <Badge 
                      variant="outline" 
                      fontSize="xs"
                      colorScheme="blue"
                    >
                      科技: {worldview.technology_level}
                    </Badge>
                  )}
                </HStack>
              </VStack>
            </HStack>
          </Box>
        ))}
        
        {data.length > 4 && (
          <Box 
            bg="gray.50" 
            _dark={{ bg: "gray.900" }}
            borderRadius="md" 
            p={3}
            textAlign="center"
          >
            <Text fontSize="sm" color="text.muted">
              +{data.length - 4} 个更多世界观
            </Text>
          </Box>
        )}
      </VStack>
    ) : (
      <Box 
        bg="gray.50" 
        _dark={{ bg: "gray.900" }}
        borderRadius="md" 
        p={8} 
        textAlign="center"
      >
        <VStack spacing={3}>
          <Text fontSize="3xl">🌍</Text>
          <Text color="text.muted">暂无世界观数据</Text>
          <Text fontSize="sm" color="text.secondary">开始构建您的世界观</Text>
        </VStack>
      </Box>
    )}
  </Box>
);

// 场景知识库总览组件
const SceneKnowledgeBase = ({ data }) => (
  <Box>
    <HStack justify="space-between" align="center" mb={4}>
      <Heading size="md" color="text.primary">场景知识库</Heading>
      <Badge colorScheme="brand">{data.length} 个场景</Badge>
    </HStack>
    
    {data.length > 0 ? (
      <VStack spacing={3} align="stretch">
        <Grid templateColumns="repeat(2, 1fr)" gap={3}>
          {data.slice(0, 6).map(scene => (
            <Box 
              key={scene.id} 
              bg="gray.50" 
              _dark={{ bg: "gray.900" }}
              borderRadius="md" 
              p={3}
              border="1px"
              borderColor="border.default"
            >
              <HStack spacing={3} align="start">
                <Text fontSize="xl">🏞️</Text>
                <VStack align="start" spacing={1} flex="1">
                  <Heading size="sm" color="text.primary">{scene.name}</Heading>
                  <Text fontSize="sm" color="text.muted">
                    {scene.description || '暂无描述'}
                  </Text>
                  <HStack spacing={2} flexWrap="wrap">
                    <Badge 
                      variant="outline" 
                      fontSize="xs"
                      colorScheme="green"
                    >
                      使用 {scene.usage_count || 0} 次
                    </Badge>
                    {scene.geography && (
                      <Badge 
                        variant="outline" 
                        fontSize="xs"
                        colorScheme="orange"
                      >
                        {scene.geography}
                      </Badge>
                    )}
                  </HStack>
                </VStack>
              </HStack>
            </Box>
          ))}
        </Grid>
        
        {data.length > 6 && (
          <Box 
            bg="gray.50" 
            _dark={{ bg: "gray.900" }}
            borderRadius="md" 
            p={3}
            textAlign="center"
          >
            <Text fontSize="sm" color="text.muted">
              +{data.length - 6} 个更多场景
            </Text>
          </Box>
        )}
      </VStack>
    ) : (
      <Box 
        bg="gray.50" 
        _dark={{ bg: "gray.900" }}
        borderRadius="md" 
        p={8} 
        textAlign="center"
      >
        <VStack spacing={3}>
          <Text fontSize="3xl">🏞️</Text>
          <Text color="text.muted">暂无场景数据</Text>
          <Text fontSize="sm" color="text.secondary">开始创建您的场景库</Text>
        </VStack>
      </Box>
    )}
  </Box>
);

// 创作技巧知识库总览组件
const WritingTechniqueKnowledgeBase = ({ data }) => (
  <Box>
    <HStack justify="space-between" align="center" mb={4}>
      <Heading size="md" color="text.primary">创作技巧库</Heading>
      <Badge colorScheme="brand">{data.length} 个分类</Badge>
    </HStack>
    
    {data.length > 0 ? (
      <VStack spacing={3} align="stretch">
        {data.slice(0, 3).map(technique => (
          <Box 
            key={technique.id} 
            bg="gray.50" 
            _dark={{ bg: "gray.900" }}
            borderRadius="md" 
            p={4}
            border="1px"
            borderColor="border.default"
          >
            <HStack spacing={3} align="start">
              <Text fontSize="2xl">✍️</Text>
              <VStack align="start" spacing={2} flex="1">
                <Heading size="sm" color="text.primary">{technique.name}</Heading>
                <Badge 
                  variant="solid" 
                  fontSize="xs"
                  colorScheme="creative"
                >
                  {technique.category}
                </Badge>
                <Text fontSize="sm" color="text.muted">
                  {technique.inspiration_notes && technique.inspiration_notes.length > 0 
                    ? technique.inspiration_notes[0] 
                    : '暂无灵感记录'}
                </Text>
                <Badge 
                  variant="outline" 
                  fontSize="xs"
                  colorScheme="gray"
                >
                  {technique.techniques ? technique.techniques.length : 0} 个技巧
                </Badge>
              </VStack>
            </HStack>
          </Box>
        ))}
        
        {data.length > 3 && (
          <Box 
            bg="gray.50" 
            _dark={{ bg: "gray.900" }}
            borderRadius="md" 
            p={3}
            textAlign="center"
          >
            <Text fontSize="sm" color="text.muted">
              +{data.length - 3} 个更多分类
            </Text>
          </Box>
        )}
      </VStack>
    ) : (
      <Box 
        bg="gray.50" 
        _dark={{ bg: "gray.900" }}
        borderRadius="md" 
        p={8} 
        textAlign="center"
      >
        <VStack spacing={3}>
          <Text fontSize="3xl">✍️</Text>
          <Text color="text.muted">暂无技巧数据</Text>
          <Text fontSize="sm" color="text.secondary">开始收集创作技巧</Text>
        </VStack>
      </Box>
    )}
  </Box>
);

export default KnowledgeBase;