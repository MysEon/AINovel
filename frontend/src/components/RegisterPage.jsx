import React, { useState } from 'react';
import { FaUser, FaLock, FaEnvelope } from 'react-icons/fa';
import { Button, Input, Field, Text, Card, Box, Flex, Alert } from '@chakra-ui/react';
import { useNotification } from './NotificationManager';

const RegisterPage = ({ onNavigate }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  const { addNotification } = useNotification();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 提交前验证所有字段
    let hasError = false;
    
    // 验证用户名
    if (username.length < 3) {
      setUsernameError('用户名至少需要3个字符');
      hasError = true;
    } else if (username.length > 50) {
      setUsernameError('用户名不能超过50个字符');
      hasError = true;
    }
    
    // 验证邮箱
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email.length > 0 && !emailRegex.test(email)) {
      setEmailError('请输入有效的邮箱地址');
      hasError = true;
    }
    
    // 验证密码
    if (password.length < 6) {
      setPasswordError('密码至少需要6个字符');
      hasError = true;
    } else if (password.length > 50) {
      setPasswordError('密码不能超过50个字符');
      hasError = true;
    }
    
    // 如果有验证错误，不提交表单
    if (hasError) {
      return;
    }
    
    setIsLoading(true);
    setError('');
    setUsernameError('');
    setEmailError('');
    setPasswordError('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // 显示全局成功通知
        addNotification({
          message: '注册成功！请登录您的账户。',
          type: 'success',
          duration: 3000
        });
        
        // 延迟一段时间后自动跳转到登录页
        setTimeout(() => {
          onNavigate('login');
        }, 1500);
      } else {
        // 处理后端返回的错误信息，确保是字符串
        let errorMessage = '注册失败';
        if (data.detail) {
          if (typeof data.detail === 'string') {
            errorMessage = data.detail;
          } else if (Array.isArray(data.detail)) {
            // 如果是数组，取第一个错误信息
            errorMessage = data.detail[0]?.msg || errorMessage;
          } else if (typeof data.detail === 'object') {
            // 如果是对象，尝试获取msg属性
            errorMessage = data.detail.msg || JSON.stringify(data.detail);
          }
        }
        setError(errorMessage);
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
        bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(34, 197, 94, 0.8) 100%)',
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

        {/* 右侧注册卡片 */}
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
                  创建账户
                </Text>
                <Text color="text.muted" fontSize="lg">
                  加入AINovel创作社区
                </Text>
              </Box>

          <form onSubmit={handleSubmit}>
            <Flex direction="column" gap={6}>
              <Field.Root invalid={!!usernameError}>
                <Field.Label>用户名</Field.Label>
                <Input
                  type="text"
                  placeholder="请输入用户名 (3-50字符)"
                  value={username}
                  onChange={(e) => {
                    const newUsername = e.target.value;
                    setUsername(newUsername);
                    // 实时验证用户名长度
                    if (newUsername.length > 0 && newUsername.length < 3) {
                      setUsernameError('用户名至少需要3个字符');
                    } else if (newUsername.length > 50) {
                      setUsernameError('用户名不能超过50个字符');
                    } else {
                      setUsernameError('');
                    }
                  }}
                  disabled={isLoading}
                  size="lg"
                  variant="outline"
                />
                {usernameError && (
                  <Field.ErrorText>{usernameError}</Field.ErrorText>
                )}
              </Field.Root>

              <Field.Root invalid={!!emailError}>
                <Field.Label>电子邮箱</Field.Label>
                <Input
                  type="email"
                  placeholder="请输入邮箱地址"
                  value={email}
                  onChange={(e) => {
                    const newEmail = e.target.value;
                    setEmail(newEmail);
                    // 简单的邮箱格式验证
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (newEmail.length > 0 && !emailRegex.test(newEmail)) {
                      setEmailError('请输入有效的邮箱地址');
                    } else {
                      setEmailError('');
                    }
                  }}
                  disabled={isLoading}
                  size="lg"
                  variant="outline"
                />
                {emailError && (
                  <Field.ErrorText>{emailError}</Field.ErrorText>
                )}
              </Field.Root>

              <Field.Root invalid={!!passwordError}>
                <Field.Label>密码</Field.Label>
                <Input
                  type="password"
                  placeholder="请输入密码 (至少6字符)"
                  value={password}
                  onChange={(e) => {
                    const newPassword = e.target.value;
                    setPassword(newPassword);
                    // 实时验证密码长度
                    if (newPassword.length > 0 && newPassword.length < 6) {
                      setPasswordError('密码至少需要6个字符');
                    } else {
                      setPasswordError('');
                    }
                  }}
                  disabled={isLoading}
                  size="lg"
                  variant="outline"
                />
                {passwordError && (
                  <Field.ErrorText>{passwordError}</Field.ErrorText>
                )}
              </Field.Root>

              {error && (
                <Alert status="error" title={error} />
              )}

              <Button
                type="submit"
                size="lg"
                bg="brand.600"
                color="white"
                _hover={{ bg: "brand.700" }}
                _active={{ bg: "brand.800" }}
                disabled={isLoading || !username || !email || !password || !!usernameError || !!emailError || !!passwordError}
                loading={isLoading}
                loadingText="注册中..."
              >
                注册
              </Button>
            </Flex>
          </form>

          <Box textAlign="center" mt={6}>
            <Text color="text.muted">
              已有账号？{' '}
              <Text
                as="button"
                color="brand.600"
                fontWeight="medium"
                onClick={() => onNavigate('login')}
                _hover={{ color: "brand.700" }}
                cursor="pointer"
                bg="none"
                border="none"
                p={0}
                fontSize="inherit"
              >
                返回登录
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

export default RegisterPage;
