import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Heading, 
  Text, 
  VStack, 
  HStack,
  Icon,
  Input
} from '@chakra-ui/react';
import { FaExclamationTriangle, FaCheckCircle, FaInfoCircle, FaQuestionCircle } from 'react-icons/fa';
import './UniversalDialog.css';

const UniversalDialog = ({
  title,
  message,
  content,
  onConfirm,
  onCancel,
  confirmText = '确认',
  cancelText = '取消',
  type = 'info',
  showInput = false,
  inputValue = '',
  onInputChange,
  inputPlaceholder = '',
  inputType = 'text',
  required = false,
  showResultNotification = false,
  successMessage = '操作成功',
  errorMessage = '操作失败',
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [currentInputValue, setCurrentInputValue] = useState(inputValue);

  useEffect(() => {
    // 阻止背景滚动
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    setCurrentInputValue(inputValue);
  }, [inputValue]);

  const handleConfirm = async () => {
    if (showInput && required && !currentInputValue.trim()) {
      return;
    }

    setIsVisible(false);
    if (onConfirm) {
      try {
        await onConfirm(currentInputValue);
      } catch (error) {
        console.error('弹窗确认错误:', error);
        throw error;
      }
    }
  };

  const handleCancel = () => {
    setIsVisible(false);
    if (onCancel) {
      onCancel();
    }
  };

  const handleClose = () => {
    handleCancel();
  };

  const getTypeClass = () => {
    switch (type) {
      case 'error':
        return 'universal-dialog-error';
      case 'warning':
        return 'universal-dialog-warning';
      case 'success':
        return 'universal-dialog-success';
      case 'info':
        return 'universal-dialog-info';
      case 'question':
        return 'universal-dialog-question';
      default:
        return 'universal-dialog-info';
    }
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'error':
        return <Icon as={FaExclamationTriangle} color="red.500" boxSize={6} />;
      case 'warning':
        return <Icon as={FaExclamationTriangle} color="orange.500" boxSize={6} />;
      case 'success':
        return <Icon as={FaCheckCircle} color="green.500" boxSize={6} />;
      case 'info':
        return <Icon as={FaInfoCircle} color="blue.500" boxSize={6} />;
      case 'question':
        return <Icon as={FaQuestionCircle} color="blue.500" boxSize={6} />;
      default:
        return <Icon as={FaInfoCircle} color="blue.500" boxSize={6} />;
    }
  };

  const isConfirmDisabled = showInput && required && !currentInputValue.trim();

  if (!isVisible) {
    return null;
  }

  return (
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
      zIndex={9999}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <Box
        bg="white"
        _dark={{ bg: "gray.800" }}
        borderRadius="lg"
        boxShadow="xl"
        maxW="md"
        w="90%"
        maxH="80vh"
        overflow="hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <Box 
          p={6} 
          borderBottom="1px" 
          borderColor="border.default"
        >
          <HStack justify="space-between" align="start">
            <HStack spacing={3} align="start">
              {getTypeIcon()}
              <Heading size="md" color="text.primary">
                {title}
              </Heading>
            </HStack>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              color="text.muted"
              _hover={{ color: "text.primary" }}
            >
              ×
            </Button>
          </HStack>
        </Box>

        {/* 内容 */}
        <Box p={6}>
          <VStack spacing={4} align="stretch">
            {message && (
              <Text color="text.secondary" lineHeight="1.6">
                {message}
              </Text>
            )}
            {content && (
              <Box color="text.primary">
                {content}
              </Box>
            )}
            {showInput && (
              <VStack spacing={2} align="stretch">
                <Input
                  type={inputType}
                  value={currentInputValue}
                  onChange={(e) => {
                    setCurrentInputValue(e.target.value);
                    if (onInputChange) {
                      onInputChange(e.target.value);
                    }
                  }}
                  placeholder={inputPlaceholder}
                  autoFocus
                />
                {required && !currentInputValue.trim() && (
                  <Text color="red.500" fontSize="sm">
                    此字段为必填项
                  </Text>
                )}
              </VStack>
            )}
          </VStack>
        </Box>

        {/* 底部按钮 */}
        <Box 
          p={6} 
          borderTop="1px" 
          borderColor="border.default"
        >
          <HStack spacing={3} justify="flex-end">
            <Button
              variant="outline"
              onClick={handleCancel}
            >
              {cancelText}
            </Button>
            <Button
              colorScheme={type === 'error' ? 'red' : type === 'warning' ? 'orange' : 'brand'}
              onClick={handleConfirm}
              isDisabled={isConfirmDisabled}
            >
              {confirmText}
            </Button>
          </HStack>
        </Box>
      </Box>
    </Box>
  );
};

export default UniversalDialog;