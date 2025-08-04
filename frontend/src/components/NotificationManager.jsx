import React, { createContext, useContext, useReducer, useState } from 'react';
import Notification from './Notification';
import UniversalDialog from './UniversalDialog';

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
    confirmText,
    cancelText,
    type,
    showInput = false,
    inputValue = '',
    onInputChange,
    inputPlaceholder = '',
    inputType = 'text',
    required = false,
    showResultNotification = false,
    successMessage = '操作成功',
    errorMessage = '操作失败'
  }) => {
    setConfirmDialog({
      title,
      message,
      content,
      onConfirm,
      onCancel,
      confirmText,
      cancelText,
      type,
      showInput,
      inputValue,
      onInputChange,
      inputPlaceholder,
      inputType,
      required,
      showResultNotification,
      successMessage,
      errorMessage
    });
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
      {confirmDialog && (
        <UniversalDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          content={confirmDialog.content}
          onConfirm={async (inputValue) => {
            try {
              if (confirmDialog.onConfirm) await confirmDialog.onConfirm(inputValue);
              hideConfirmDialog();
              
              // 显示操作成功通知
              if (confirmDialog.showResultNotification) {
                addNotification({
                  message: confirmDialog.successMessage,
                  type: 'success',
                  duration: 3000
                });
              }
            } catch (error) {
              hideConfirmDialog();
              
              // 显示操作失败通知
              if (confirmDialog.showResultNotification) {
                addNotification({
                  message: confirmDialog.errorMessage,
                  type: 'error',
                  duration: 3000
                });
              }
            }
          }}
          onCancel={() => {
            if (confirmDialog.onCancel) confirmDialog.onCancel();
            hideConfirmDialog();
          }}
          confirmText={confirmDialog.confirmText}
          cancelText={confirmDialog.cancelText}
          type={confirmDialog.type}
          showInput={confirmDialog.showInput}
          inputValue={confirmDialog.inputValue}
          onInputChange={confirmDialog.onInputChange}
          inputPlaceholder={confirmDialog.inputPlaceholder}
          inputType={confirmDialog.inputType}
          required={confirmDialog.required}
        />
      )}
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