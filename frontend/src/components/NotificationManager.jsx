import React, { createContext, useContext, useReducer, useState } from 'react';
import { App, Modal, message } from 'antd';
import { 
  ExclamationCircleOutlined, 
  CheckCircleOutlined, 
  InfoCircleOutlined, 
  QuestionCircleOutlined 
} from '@ant-design/icons';
import Notification from './Notification';

const NotificationContext = createContext();

const notificationReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      return [...state, { ...action.payload, id: Date.now() + Math.random() }];
    case 'REMOVE_NOTIFICATION':
      return state.filter(notification => notification.id !== action.payload);
    default:
      return state;
  }
};

export const NotificationProvider = ({ children }) => {
  const [notifications, dispatch] = useReducer(notificationReducer, []);
  const { message: messageApi, modal: modalApi } = App.useApp();

  const addNotification = (notification) => {
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        ...notification,
        id: Date.now() + Math.random()
      }
    });

    // 自动移除通知
    if (notification.duration !== 0) {
      setTimeout(() => {
        removeNotification(notification.id);
      }, notification.duration || 3000);
    }
  };

  const showConfirmDialog = ({
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
    expectedValue = '',
    onInputChange,
    inputPlaceholder = '',
    inputType = 'text',
    required = false,
    showResultNotification = false,
    successMessage = '操作成功',
    errorMessage = '操作失败',
    className = ''
  }) => {
    const getIcon = () => {
      switch (type) {
        case 'error':
          return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
        case 'warning':
          return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
        case 'success':
          return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
        case 'question':
          return <QuestionCircleOutlined style={{ color: '#1890ff' }} />;
        default:
          return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
      }
    };

    // 创建受控输入组件
    const ConfirmInput = ({ onValueChange }) => {
      const [inputValueState, setInputValueState] = React.useState(inputValue);
      
      const handleChange = (e) => {
        const value = e.target.value;
        setInputValueState(value);
        if (onValueChange) onValueChange(value);
        if (onInputChange) onInputChange(value);
      };
      
      return (
        <div>
          {message && <p style={{ marginBottom: content ? '12px' : '0' }}>{message}</p>}
          {content}
          {showInput && (
            <input
              type={inputType}
              value={inputValueState}
              onChange={handleChange}
              placeholder={inputPlaceholder}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                marginTop: '12px',
                fontSize: '14px'
              }}
              autoFocus
            />
          )}
        </div>
      );
    };

    let modalValue = '';
    let modalInstance = null;
    
    const updateOkButton = (value) => {
      if (modalInstance && modalInstance.update) {
        // 如果设置了 expectedValue，需要匹配确认（用于危险操作）
        // 如果没有设置 expectedValue，只需要输入不为空（用于章节创建等）
        const isMatch = expectedValue.trim() 
          ? value.trim() === expectedValue.trim() 
          : value.trim().length > 0;
        
        modalInstance.update({
          okButtonProps: {
            disabled: showInput && required && !isMatch,
            danger: type === 'error'
          }
        });
      }
    };
    
    modalInstance = modalApi.confirm({
      title,
      content: <ConfirmInput onValueChange={(value) => { 
        modalValue = value;
        updateOkButton(value);
      }} />,
      icon: getIcon(),
      okText: confirmText,
      cancelText: cancelText,
      okButtonProps: {
        disabled: showInput && required && !inputValue.trim(),
        danger: type === 'error'
      },
      onOk: async () => {
        try {
          if (onConfirm) await onConfirm(modalValue);
          
          if (showResultNotification) {
            messageApi.success(successMessage);
          }
          // Modal 会自动关闭，不需要手动处理
        } catch (error) {
          if (showResultNotification) {
            messageApi.error(errorMessage);
          }
          console.error('An error occurred in onConfirm:', error);
        }
      },
      onCancel: () => {
        if (onCancel) onCancel();
        // Modal 会自动关闭，不需要手动处理
      },
      className: `confirm-dialog-${type} ${className}`,
      width: showInput ? 480 : 420,
    });
  };

  const hideConfirmDialog = () => {
    // This function is now a no-op, but we'll keep it for API consistency
    // in case other components are calling it.
    // A better long-term solution would be to remove it entirely and
    // update all call sites.
  };

  const removeNotification = (id) => {
    dispatch({
      type: 'REMOVE_NOTIFICATION',
      payload: id
    });
  };

  return (
    <NotificationContext.Provider value={{ addNotification, removeNotification, showConfirmDialog, hideConfirmDialog }}>
      {children}
      <div className="notifications-container">
        {notifications.map((notification) => (
          <Notification
            key={notification.id}
            message={notification.message}
            type={notification.type}
            duration={notification.duration}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;