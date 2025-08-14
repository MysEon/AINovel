import React, { useState } from 'react';
import { FaUser, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';
import { Button, Input, Field, Text, Card, Box, Flex, Center } from '@chakra-ui/react';

const LoginPage = ({ onLogin, onNavigate }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        onLogin(data.access_token);
      } else {
        setError(data.detail || '登录失败');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box 
      minH="100vh" 
      bgImage="url('/images/image.png')"
      bgSize="cover"
      bgPosition="center"
      bgRepeat="no-repeat"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
      position="relative"
      _before={{
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(245, 158, 11, 0.8) 100%)',
        backdropFilter: 'blur(2px)',
        zIndex: 1
      }}
    >
      <Flex 
        w="100%" 
        maxW="6xl" 
        h="100vh"
        position="relative"
        zIndex={2}
        align="center"
      >
        {/* 左侧 Logo 和 Slogan */}
        <Box 
          flex="1" 
          display="flex" 
          flexDirection="column" 
          alignItems="center" 
          justifyContent="center"
          textAlign="center"
          pr={8}
        >
          <Box 
            w="200px" 
            h="200px" 
            bg="rgba(255, 255, 255, 0.1)" 
            borderRadius="50%" 
            display="flex" 
            alignItems="center" 
            justifyContent="center"
            backdropFilter="blur(10px)"
            border="2px solid rgba(255, 255, 255, 0.2)"
            mb={8}
          >
            <Text fontSize="6xl" fontWeight="bold" color="white">
              AI
            </Text>
          </Box>
          <Text fontSize="5xl" fontWeight="bold" color="white" mb={4}>
            AINovel
          </Text>
          <Text fontSize="2xl" color="rgba(255, 255, 255, 0.9)" mb={2}>
            AI驱动的小说创作平台
          </Text>
          <Text fontSize="lg" color="rgba(255, 255, 255, 0.7)">
            让创意与智能完美融合，开启写作新纪元
          </Text>
        </Box>

        {/* 右侧登录卡片 */}
        <Box flex="1" maxW="md">
          <Card.Root 
            w="100%" 
            boxShadow="xl"
            backdropFilter="blur(10px)"
            bg="rgba(255, 255, 255, 0.95)"
            _dark={{
              bg: "rgba(26, 32, 44, 0.95)",
              borderColor: "gray.700"
            }}
          >
          <Card.Body p={8}>
              <Box textAlign="center" mb={8}>
                <Text fontSize="2xl" fontWeight="bold" color="brand.600" mb={2}>
                  欢迎回来
                </Text>
                <Text color="text.muted" fontSize="lg">
                  登录您的账户继续创作
                </Text>
              </Box>

          <form onSubmit={handleSubmit}>
            <Flex direction="column" gap={6}>
              <Field.Root invalid={!!error}>
                <Field.Label>用户名</Field.Label>
                <Input
                  type="text"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  size="lg"
                  variant="outline"
                />
              </Field.Root>

              <Field.Root invalid={!!error}>
                <Field.Label>密码</Field.Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  size="lg"
                  variant="outline"
                />
              </Field.Root>

              {error && (
                <Text color="danger" fontSize="sm" textAlign="center">
                  {error}
                </Text>
              )}

              <Button
                type="submit"
                size="lg"
                bg="brand.600"
                color="white"
                _hover={{ bg: "brand.700" }}
                _active={{ bg: "brand.800" }}
                disabled={isLoading || !username || !password}
                loading={isLoading}
                loadingText="登录中..."
              >
                登录
              </Button>
            </Flex>
          </form>

          <Box textAlign="center" mt={6}>
            <Text color="text.muted">
              还没有账号？{' '}
              <Text
                as="button"
                color="brand.600"
                fontWeight="medium"
                onClick={() => onNavigate('register')}
                _hover={{ color: "brand.700" }}
                cursor="pointer"
                bg="none"
                border="none"
                p={0}
                fontSize="inherit"
              >
                立即注册
              </Text>
            </Text>
          </Box>
            </Card.Body>
          </Card.Root>
        </Box>
      </Flex>
    </Box>
  );
};

export default LoginPage;