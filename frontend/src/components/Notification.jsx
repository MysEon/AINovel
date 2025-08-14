import React, { useState, useEffect } from 'react';
import { 
  Box, 
  HStack, 
  Text, 
  Icon,
  CloseButton
} from '@chakra-ui/react';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle } from 'react-icons/fa';
import './Notification.css';

const Notification = ({ message, type = 'info', duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      setTimeout(onClose, 300); // 等待动画结束后调用onClose
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <Icon as={FaCheckCircle} color="green.500" boxSize={5} />;
      case 'error':
        return <Icon as={FaExclamationCircle} color="red.500" boxSize={5} />;
      case 'warning':
        return <Icon as={FaExclamationCircle} color="orange.500" boxSize={5} />;
      default:
        return <Icon as={FaInfoCircle} color="blue.500" boxSize={5} />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'green.50';
      case 'error':
        return 'red.50';
      case 'warning':
        return 'orange.50';
      default:
        return 'blue.50';
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return 'green.200';
      case 'error':
        return 'red.200';
      case 'warning':
        return 'orange.200';
      default:
        return 'blue.200';
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Box
      position="fixed"
      top="4"
      right="4"
      zIndex={9999}
      maxW="md"
      bg={getBgColor()}
      _dark={{
        bg: type === 'success' ? 'green.900' : 
             type === 'error' ? 'red.900' : 
             type === 'warning' ? 'orange.900' : 'blue.900'
      }}
      border="1px"
      borderColor={getBorderColor()}
      borderRadius="md"
      boxShadow="lg"
      p={4}
      animation="slideIn 0.3s ease-out"
    >
      <HStack align="start" spacing={3}>
        {getIcon()}
        <Text 
          flex="1" 
          color="text.primary" 
          fontSize="sm"
          lineHeight="1.4"
        >
          {message}
        </Text>
        <CloseButton 
          size="sm" 
          onClick={handleClose}
          color="text.muted"
          _hover={{ color: "text.primary" }}
        />
      </HStack>
    </Box>
  );
};

export default Notification;