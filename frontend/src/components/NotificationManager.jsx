import React, { createContext, useContext, useReducer, useState } from 'react';
import { Modal, message } from 'antd';
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
  const [confirmDialog, setConfirmDialog] = useState(null);

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

    const modal = Modal.confirm({
      title,
      content: (
        <div>
          {message && <p style={{ marginBottom: content ? '12px' : '0' }}>{message}</p>}
          {content}
          {showInput && (
            <input
              type={inputType}
              value={inputValue}
              onChange={(e) => {
                if (onInputChange) onInputChange(e.target.value);
              }}
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
      ),
      icon: getIcon(),
      okText: confirmText,
      cancelText: cancelText,
      okButtonProps: {
        disabled: showInput && required && !inputValue.trim(),
        danger: type === 'error'
      },
      onOk: async () => {
        try {
          if (onConfirm) await onConfirm(inputValue);
          
          if (showResultNotification) {
            message.success(successMessage);
          }
        } catch (error) {
          if (showResultNotification) {
            message.error(errorMessage);
          }
          throw error;
        }
      },
      onCancel: () => {
        if (onCancel) onCancel();
      },
      className: `confirm-dialog-${type} ${className}`,
      width: showInput ? 480 : 420
    });

    setConfirmDialog(modal);
  };

  const hideConfirmDialog = () => {
    setConfirmDialog(null);
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