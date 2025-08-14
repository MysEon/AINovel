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
        bg: 'rgba(255, 255, 255, 0.3)',
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
            boxShadow="0 8px 32px 0 rgba(31, 38, 135, 0.37)"
            border="1px solid rgba(255, 255, 255, 0.18)"
            backdropFilter="blur(4px)"
            WebkitBackdropFilter="blur(4px)"
            bg="rgba(255, 255, 255, 0.15)"
            borderRadius="24px"
            _light={{
              bg: "rgba(255, 255, 255, 0.85)",
              borderColor: "rgba(0, 0, 0, 0.1)",
              boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.1)"
            }}
            _dark={{
              bg: "rgba(26, 32, 44, 0.25)",
              borderColor: "rgba(255, 255, 255, 0.125)"
            }}
          >
          <Card.Body p={12}>
              <Box textAlign="center" mb={12}>
                <Text fontSize="4xl" fontWeight="200" color="white" mb={4} letterSpacing="tight" _light={{ color: "gray.800" }}>
                  欢迎回来
                </Text>
                <Text color="rgba(255, 255, 255, 0.85)" fontSize="lg" fontWeight="300" _light={{ color: "gray.600" }}>
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
                  bg="rgba(255, 255, 255, 0.1)"
                  border="1px solid rgba(255, 255, 255, 0.2)"
                  color="white"
                  _placeholder={{ color: "rgba(255, 255, 255, 0.6)" }}
                  _focus={{ 
                    bg: "rgba(255, 255, 255, 0.15)",
                    borderColor: "rgba(255, 255, 255, 0.4)",
                    boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.3)"
                  }}
                  backdropFilter="blur(4px)"
                  WebkitBackdropFilter="blur(4px)"
                  borderRadius="12px"
                  _light={{
                    bg: "rgba(255, 255, 255, 0.9)",
                    border: "1px solid rgba(0, 0, 0, 0.1)",
                    color: "gray.800",
                    _placeholder: { color: "gray.400" },
                    _focus: { 
                      bg: "white",
                      borderColor: "brand.500",
                      boxShadow: "0 0 0 1px rgba(59, 130, 246, 0.3)"
                    }
                  }}
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
                  bg="rgba(255, 255, 255, 0.1)"
                  border="1px solid rgba(255, 255, 255, 0.2)"
                  color="white"
                  _placeholder={{ color: "rgba(255, 255, 255, 0.6)" }}
                  _focus={{ 
                    bg: "rgba(255, 255, 255, 0.15)",
                    borderColor: "rgba(255, 255, 255, 0.4)",
                    boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.3)"
                  }}
                  backdropFilter="blur(4px)"
                  WebkitBackdropFilter="blur(4px)"
                  borderRadius="12px"
                  _light={{
                    bg: "rgba(255, 255, 255, 0.9)",
                    border: "1px solid rgba(0, 0, 0, 0.1)",
                    color: "gray.800",
                    _placeholder: { color: "gray.400" },
                    _focus: { 
                      bg: "white",
                      borderColor: "brand.500",
                      boxShadow: "0 0 0 1px rgba(59, 130, 246, 0.3)"
                    }
                  }}
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
                bg="linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.15) 100%)"
                color="white"
                border="1px solid rgba(255, 255, 255, 0.25)"
                boxShadow="0 4px 15px 0 rgba(31, 38, 135, 0.2)"
                backdropFilter="blur(4px)"
                WebkitBackdropFilter="blur(4px)"
                borderRadius="16px"
                _hover={{ 
                  bg: "linear-gradient(135deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.25) 100%)",
                  borderColor: "rgba(255, 255, 255, 0.35)",
                  boxShadow: "0 6px 20px 0 rgba(31, 38, 135, 0.3)"
                }}
                _active={{ 
                  bg: "linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.3) 100%)",
                  boxShadow: "0 2px 10px 0 rgba(31, 38, 135, 0.2)"
                }}
                disabled={isLoading || !username || !password}
                loading={isLoading}
                loadingText="登录中..."
                fontSize="md"
                py={7}
                fontWeight="500"
                transition="all 0.3s ease"
                _light={{
                  bg: "brand.600",
                  color: "white",
                  border: "none",
                  boxShadow: "0 4px 12px 0 rgba(59, 130, 246, 0.3)",
                  _hover: { 
                    bg: "brand.700",
                    boxShadow: "0 6px 16px 0 rgba(59, 130, 246, 0.4)"
                  },
                  _active: { 
                    bg: "brand.800"
                  }
                }}
              >
                登录
              </Button>
            </Flex>
          </form>

          <Box textAlign="center" mt={8}>
            <Text color="rgba(255, 255, 255, 0.7)" fontSize="sm" _light={{ color: "gray.600" }}>
              还没有账号？{' '}
              <Text
                as="button"
                color="white"
                fontWeight="500"
                onClick={() => onNavigate('register')}
                _hover={{ color: "rgba(255, 255, 255, 0.9)" }}
                cursor="pointer"
                bg="none"
                border="none"
                p={0}
                fontSize="inherit"
                textDecoration="underline"
                textDecorationStyle="dotted"
                textUnderlineOffset="2px"
                _light={{
                  color: "brand.600",
                  _hover: { color: "brand.700" }
                }}
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