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
  Progress,
  Switch,
  Field,
  FieldLabel,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton
} from '@chakra-ui/react';
import { FaPlay, FaPause, FaStop, FaCog, FaChartLine, FaMagic, FaLightbulb, FaUsers, FaBook, FaSpinner as FaSpinnerIcon } from 'react-icons/fa';
import { aiService } from '../services/aiService';
import { useNotification } from '../NotificationManager';
import './AIWorkflowManager.css';

const AIWorkflowManager = ({ projectId }) => {
  const [workflows, setWorkflows] = useState([]);
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  const [workflowStatus, setWorkflowStatus] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const { addNotification } = useNotification();

  // 预定义的工作流模板
  const workflowTemplates = [
    {
      id: 'chapter_creation',
      name: '章节创作工作流',
      description: '从大纲到完成的章节内容',
      icon: <FaBook />,
      steps: [
        { id: 'outline', name: '生成大纲', icon: <FaLightbulb /> },
        { id: 'draft', name: '创作草稿', icon: <FaMagic /> },
        { id: 'review', name: '内容审查', icon: <FaChartLine /> },
        { id: 'optimize', name: '优化完善', icon: <FaCog /> }
      ]
    },
    {
      id: 'character_development',
      name: '角色开发工作流',
      description: '深度开发和塑造角色',
      icon: <FaUsers />,
      steps: [
        { id: 'profile', name: '角色档案', icon: <FaUsers /> },
        { id: 'relationships', name: '关系网络', icon: <FaUsers /> },
        { id: 'dialogue', name: '对话风格', icon: <FaBook /> },
        { id: 'consistency', name: '一致性检查', icon: <FaChartLine /> }
      ]
    },
    {
      id: 'plot_enhancement',
      name: '情节优化工作流',
      description: '提升情节的吸引力和连贯性',
      icon: <FaMagic />,
      steps: [
        { id: 'analysis', name: '情节分析', icon: <FaChartLine /> },
        { id: 'suggestions', name: '改进建议', icon: <FaLightbulb /> },
        { id: 'integration', name: '整合优化', icon: <FaCog /> },
        { id: 'validation', name: '效果验证', icon: <FaChartLine /> }
      ]
    }
  ];

  useEffect(() => {
    loadWorkflows();
  }, [projectId]);

  const loadWorkflows = async () => {
    try {
      setIsLoading(true);
      const availableWorkflows = await aiService.getAvailableWorkflows();
      setWorkflows(availableWorkflows.length > 0 ? availableWorkflows : workflowTemplates);
    } catch (error) {
      // 如果后端API不可用，使用模板工作流
      setWorkflows(workflowTemplates);
      addNotification({
        message: '使用默认工作流模板: ' + error.message,
        type: 'warning'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startWorkflow = async (workflowId) => {
    try {
      setIsLoading(true);
      const workflow = workflows.find(w => w.id === workflowId);
      if (!workflow) return;

      setActiveWorkflow(workflow);
      setWorkflowStatus(prev => ({
        ...prev,
        [workflowId]: {
          status: 'running',
          currentStep: 0,
          startTime: new Date(),
          progress: 0
        }
      }));

      // 模拟工作流执行过程
      await simulateWorkflowExecution(workflow);
      
      addNotification({
        message: `工作流 "${workflow.name}" 执行完成`,
        type: 'success'
      });
    } catch (error) {
      addNotification({
        message: `工作流执行失败: ${error.message}`,
        type: 'error'
      });
      setWorkflowStatus(prev => ({
        ...prev,
        [workflowId]: {
          status: 'failed',
          error: error.message
        }
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const simulateWorkflowExecution = async (workflow) => {
    const steps = workflow.steps || [];
    for (let i = 0; i < steps.length; i++) {
      setWorkflowStatus(prev => ({
        ...prev,
        [workflow.id]: {
          ...prev[workflow.id],
          currentStep: i,
          progress: ((i + 1) / steps.length) * 100
        }
      }));
      
      // 模拟每个步骤的执行时间
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    setWorkflowStatus(prev => ({
      ...prev,
      [workflow.id]: {
        ...prev[workflow.id],
        status: 'completed',
        progress: 100,
        endTime: new Date()
      }
    }));
  };

  const stopWorkflow = (workflowId) => {
    setWorkflowStatus(prev => ({
      ...prev,
      [workflowId]: {
        ...prev[workflowId],
        status: 'stopped',
        endTime: new Date()
      }
    }));
    
    addNotification({
      message: '工作流已停止',
      type: 'info'
    });
  };

  const configureWorkflow = (workflow) => {
    setSelectedWorkflow(workflow);
    setShowConfig(true);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return <Icon as={FaSpinnerIcon} color="blue.500" />;
      case 'completed':
        return <Icon as={FaChartLine} color="green.500" />;
      case 'failed':
        return <Icon as={FaStop} color="red.500" />;
      case 'stopped':
        return <Icon as={FaPause} color="orange.500" />;
      default:
        return <Icon as={FaPlay} color="gray.500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return 'blue';
      case 'completed':
        return 'green';
      case 'failed':
        return 'red';
      case 'stopped':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return '-';
    const duration = Math.floor((endTime - startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isLoading && workflows.length === 0) {
    return (
      <Box h="100vh" display="flex" alignItems="center" justifyContent="center" bg="bg.canvas">
        <VStack spacing={4}>
          <Spinner size="xl" color="brand.500" />
          <Text color="text.muted">加载工作流...</Text>
        </VStack>
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
        <VStack spacing={2} align="stretch">
          <Heading size="lg" color="text.primary">AI写作工作流</Heading>
          <Text color="text.muted">智能化创作流程管理，提升写作效率</Text>
        </VStack>
      </Box>

      {/* 工作流网格 */}
      <Grid templateColumns="repeat(auto-fit, minmax(400px, 1fr))" gap={6}>
        {workflows.map(workflow => {
          const status = workflowStatus[workflow.id];
          const isActive = activeWorkflow?.id === workflow.id;
          
          return (
            <Box 
              key={workflow.id} 
              bg="white" 
              _dark={{ bg: "gray.800" }}
              borderRadius="lg" 
              boxShadow="sm" 
              border="2px"
              borderColor={isActive ? 'brand.500' : status ? `${getStatusColor(status.status)}.500` : 'transparent'}
              overflow="hidden"
            >
              {/* 工作流头部 */}
              <Box p={4} borderBottom="1px" borderColor="border.default">
                <HStack justify="space-between" align="start">
                  <HStack spacing={3} align="start">
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
                      <Icon as={workflow.icon.type || FaBook} fontSize="xl" color="brand.500" />
                    </Box>
                    <VStack align="start" spacing={1} flex="1">
                      <Heading size="md" color="text.primary">{workflow.name}</Heading>
                      <Text fontSize="sm" color="text.muted">{workflow.description}</Text>
                    </VStack>
                  </HStack>
                  <Box>
                    {status && getStatusIcon(status.status)}
                  </Box>
                </HStack>
              </Box>

              {/* 工作流步骤 */}
              <Box p={4}>
                <VStack spacing={3} align="stretch">
                  <Heading size="sm" color="text.primary">工作流程</Heading>
                  <VStack spacing={2} align="stretch">
                    {(workflow.steps || []).map((step, index) => (
                      <HStack 
                        key={step.id} 
                        spacing={3}
                        p={2}
                        borderRadius="md"
                        bg={status && status.currentStep === index ? 'brand.50' : 
                            status && status.currentStep > index ? 'green.50' : 'gray.50'}
                        _dark={{ bg: status && status.currentStep === index ? 'brand.900' : 
                                   status && status.currentStep > index ? 'green.900' : 'gray.900'}}
                      >
                        <Box 
                          w="8" 
                          h="8" 
                          borderRadius="full" 
                          display="flex" 
                          alignItems="center" 
                          justifyContent="center"
                          bg={status && status.currentStep === index ? 'brand.500' : 
                              status && status.currentStep > index ? 'green.500' : 'gray.400'}
                        >
                          <Icon as={step.icon.type || FaMagic} fontSize="sm" color="white" />
                        </Box>
                        <HStack justify="space-between" flex="1">
                          <Text fontSize="sm" color="text.primary">{step.name}</Text>
                          {status && status.currentStep === index && (
                            <Badge colorScheme="brand" fontSize="xs">
                              {Math.round(status.progress)}%
                            </Badge>
                          )}
                        </HStack>
                      </HStack>
                    ))}
                  </VStack>
                </VStack>
              </Box>

              {/* 进度条 */}
              {status && (
                <Box p={4} borderTop="1px" borderColor="border.default">
                  <VStack spacing={2} align="stretch">
                    <Progress 
                      value={status.progress || 0} 
                      colorScheme={getStatusColor(status.status)}
                      size="sm"
                      borderRadius="full"
                    />
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="text.primary">
                        {status.status === 'running' ? '执行中...' : 
                         status.status === 'completed' ? '已完成' :
                         status.status === 'failed' ? '执行失败' :
                         status.status === 'stopped' ? '已停止' : '准备就绪'}
                      </Text>
                      {status.startTime && (
                        <Text fontSize="sm" color="text.muted">
                          {formatDuration(status.startTime, status.endTime)}
                        </Text>
                      )}
                    </HStack>
                  </VStack>
                </Box>
              )}

              {/* 操作按钮 */}
              <Box p={4} borderTop="1px" borderColor="border.default">
                <HStack spacing={3}>
                  <Button
                    leftIcon={status?.status === 'running' ? <Icon as={FaStop} /> : <Icon as={FaPlay} />}
                    onClick={() => status?.status === 'running' 
                      ? stopWorkflow(workflow.id) 
                      : startWorkflow(workflow.id)
                    }
                    isDisabled={isLoading}
                    colorScheme={status?.status === 'running' ? 'red' : 'brand'}
                    flex="1"
                  >
                    {status?.status === 'running' ? '停止' : '启动'}
                  </Button>
                  
                  <Button
                    leftIcon={<Icon as={FaCog} />}
                    onClick={() => configureWorkflow(workflow)}
                    isDisabled={isLoading}
                    variant="outline"
                  >
                    配置
                  </Button>
                </HStack>
              </Box>
            </Box>
          );
        })}
      </Grid>

      {showConfig && selectedWorkflow && (
        <WorkflowConfigDialog 
          workflow={selectedWorkflow}
          onClose={() => setShowConfig(false)}
          onSave={(config) => {
            addNotification({
              message: `工作流 "${selectedWorkflow.name}" 配置已保存`,
              type: 'success'
            });
            setShowConfig(false);
          }}
        />
      )}
    </Box>
  );
};

const WorkflowConfigDialog = ({ workflow, onClose, onSave }) => {
  const [config, setConfig] = useState({
    autoStart: false,
    retryOnError: true,
    maxRetries: 3,
    timeout: 300,
    notifications: true
  });

  const handleSave = () => {
    onSave(config);
  };

  return (
    <Modal isOpen={true} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Heading size="md" color="text.primary">配置工作流: {workflow.name}</Heading>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={6} align="stretch">
            <Box>
              <Heading size="sm" color="text.primary" mb={4}>执行设置</Heading>
              <VStack spacing={4} align="stretch">
                <Field>
                  <FieldLabel color="text.primary">自动启动</FieldLabel>
                  <Switch
                    isChecked={config.autoStart}
                    onChange={(e) => setConfig(prev => ({ ...prev, autoStart: e.target.checked }))}
                  />
                </Field>
                
                <Field>
                  <FieldLabel color="text.primary">出错时重试</FieldLabel>
                  <Switch
                    isChecked={config.retryOnError}
                    onChange={(e) => setConfig(prev => ({ ...prev, retryOnError: e.target.checked }))}
                  />
                </Field>
                
                {config.retryOnError && (
                  <Field>
                    <FieldLabel color="text.primary">最大重试次数</FieldLabel>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={config.maxRetries}
                      onChange={(e) => setConfig(prev => ({ ...prev, maxRetries: parseInt(e.target.value) }))}
                    />
                  </Field>
                )}
                
                <Field>
                  <FieldLabel color="text.primary">超时时间(秒)</FieldLabel>
                  <Input
                    type="number"
                    min="30"
                    max="3600"
                    value={config.timeout}
                    onChange={(e) => setConfig(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
                  />
                </Field>
              </VStack>
            </Box>
            
            <Box>
              <Heading size="sm" color="text.primary" mb={4}>通知设置</Heading>
              <VStack spacing={4} align="stretch">
                <Field>
                  <FieldLabel color="text.primary">启用通知</FieldLabel>
                  <Switch
                    isChecked={config.notifications}
                    onChange={(e) => setConfig(prev => ({ ...prev, notifications: e.target.checked }))}
                  />
                </Field>
              </VStack>
            </Box>
          </VStack>
        </ModalBody>
        
        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button colorScheme="brand" onClick={handleSave}>
              保存
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AIWorkflowManager;