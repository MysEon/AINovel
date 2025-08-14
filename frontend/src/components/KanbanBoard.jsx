import React from 'react';
import { 
  Box, 
  Heading, 
  Text, 
  HStack, 
  VStack,
  Grid,
  Badge,
  // Divider removed
} from '@chakra-ui/react';
import './KanbanBoard.css';

const KanbanBoard = () => {
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
          <Heading size="lg" color="text.primary">项目看板</Heading>
          <Text color="text.muted">看板功能正在开发中...</Text>
        </VStack>
      </Box>

      {/* 看板内容 */}
      <Box flex="1" overflow="auto">
        <Grid templateColumns="repeat(3, 1fr)" gap={6} h="100%">
          {/* 待办列 */}
          <Box 
            bg="white" 
            _dark={{ bg: "gray.800" }}
            borderRadius="lg" 
            boxShadow="sm" 
            p={4}
            display="flex" 
            flexDirection="column"
          >
            <HStack justify="space-between" align="center" mb={4}>
              <Heading size="md" color="text.primary">待办</Heading>
              <Badge colorScheme="gray">2</Badge>
            </HStack>
            <VStack spacing={3} align="stretch" flex="1">
              <Box 
                bg="gray.50" 
                _dark={{ bg: "gray.900" }}
                borderRadius="md" 
                p={3}
                border="1px"
                borderColor="border.default"
              >
                <Text fontSize="sm" color="text.primary">创建角色设定</Text>
              </Box>
              <Box 
                bg="gray.50" 
                _dark={{ bg: "gray.900" }}
                borderRadius="md" 
                p={3}
                border="1px"
                borderColor="border.default"
              >
                <Text fontSize="sm" color="text.primary">设计故事大纲</Text>
              </Box>
            </VStack>
          </Box>

          {/* 进行中列 */}
          <Box 
            bg="white" 
            _dark={{ bg: "gray.800" }}
            borderRadius="lg" 
            boxShadow="sm" 
            p={4}
            display="flex" 
            flexDirection="column"
          >
            <HStack justify="space-between" align="center" mb={4}>
              <Heading size="md" color="text.primary">进行中</Heading>
              <Badge colorScheme="blue">2</Badge>
            </HStack>
            <VStack spacing={3} align="stretch" flex="1">
              <Box 
                bg="blue.50" 
                _dark={{ bg: "blue.900", borderColor: "blue.700" }}
                borderRadius="md" 
                p={3}
                border="1px"
                borderColor="blue.200"
              >
                <Text fontSize="sm" color="text.primary">编写第一章</Text>
              </Box>
              <Box 
                bg="blue.50" 
                _dark={{ bg: "blue.900", borderColor: "blue.700" }}
                borderRadius="md" 
                p={3}
                border="1px"
                borderColor="blue.200"
              >
                <Text fontSize="sm" color="text.primary">完善世界观</Text>
              </Box>
            </VStack>
          </Box>

          {/* 已完成列 */}
          <Box 
            bg="white" 
            _dark={{ bg: "gray.800" }}
            borderRadius="lg" 
            boxShadow="sm" 
            p={4}
            display="flex" 
            flexDirection="column"
          >
            <HStack justify="space-between" align="center" mb={4}>
              <Heading size="md" color="text.primary">已完成</Heading>
              <Badge colorScheme="green">2</Badge>
            </HStack>
            <VStack spacing={3} align="stretch" flex="1">
              <Box 
                bg="green.50" 
                _dark={{ bg: "green.900", borderColor: "green.700" }}
                borderRadius="md" 
                p={3}
                border="1px"
                borderColor="green.200"
              >
                <Text fontSize="sm" color="text.primary">项目初始化</Text>
              </Box>
              <Box 
                bg="green.50" 
                _dark={{ bg: "green.900", borderColor: "green.700" }}
                borderRadius="md" 
                p={3}
                border="1px"
                borderColor="green.200"
              >
                <Text fontSize="sm" color="text.primary">基础设定完成</Text>
              </Box>
            </VStack>
          </Box>
        </Grid>
      </Box>
    </Box>
  );
};

export default KanbanBoard;