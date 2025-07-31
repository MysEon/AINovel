import React, { useState, useEffect } from 'react';
import { FaExclamationTriangle, FaTimes } from 'react-icons/fa';
import './ConfirmDialog.css';

const ConfirmDialog = ({ 
  title = '确认操作',
  message, 
  onConfirm, 
  onCancel, 
  confirmText = '确认', 
  cancelText = '取消',
  type = 'warning'
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // 阻止背景滚动
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleConfirm = () => {
    setIsVisible(false);
    if (onConfirm) {
      setTimeout(onConfirm, 300);
    }
  };

  const handleCancel = () => {
    setIsVisible(false);
    if (onCancel) {
      setTimeout(onCancel, 300);
    }
  };

  const handleClose = () => {
    handleCancel();
  };

  const getTypeClass = () => {
    switch (type) {
      case 'error':
        return 'confirm-dialog-error';
      case 'warning':
        return 'confirm-dialog-warning';
      default:
        return 'confirm-dialog-warning';
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="confirm-dialog-overlay">
      <div className={`confirm-dialog ${getTypeClass()}`}>
        <div className="confirm-dialog-header">
          <div className="confirm-dialog-title">
            <FaExclamationTriangle className="confirm-dialog-icon" />
            <h3>{title}</h3>
          </div>
          <button className="confirm-dialog-close" onClick={handleClose}>
            <FaTimes />
          </button>
        </div>
        <div className="confirm-dialog-content">
          <p className="confirm-dialog-message">{message}</p>
        </div>
        <div className="confirm-dialog-actions">
          <button className="confirm-dialog-button cancel" onClick={handleCancel}>
            {cancelText}
          </button>
          <button className="confirm-dialog-button confirm" onClick={handleConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;