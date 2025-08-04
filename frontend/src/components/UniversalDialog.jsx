import React, { useState, useEffect } from 'react';
import { FaExclamationTriangle, FaCheckCircle, FaInfoCircle, FaTimes, FaQuestionCircle } from 'react-icons/fa';
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
        console.error('Dialog confirm error:', error);
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
        return <FaExclamationTriangle className="universal-dialog-icon" />;
      case 'warning':
        return <FaExclamationTriangle className="universal-dialog-icon" />;
      case 'success':
        return <FaCheckCircle className="universal-dialog-icon" />;
      case 'info':
        return <FaInfoCircle className="universal-dialog-icon" />;
      case 'question':
        return <FaQuestionCircle className="universal-dialog-icon" />;
      default:
        return <FaInfoCircle className="universal-dialog-icon" />;
    }
  };

  const isConfirmDisabled = showInput && required && !currentInputValue.trim();

  if (!isVisible) {
    return null;
  }

  return (
    <div className="universal-dialog-overlay">
      <div className={`universal-dialog ${getTypeClass()} ${className}`}>
        <div className="universal-dialog-header">
          <div className="universal-dialog-title">
            {getTypeIcon()}
            <h3>{title}</h3>
          </div>
          <button className="universal-dialog-close" onClick={handleClose}>
            <FaTimes />
          </button>
        </div>
        <div className="universal-dialog-content">
          {message && <p className="universal-dialog-message">{message}</p>}
          {content && <div className="universal-dialog-custom-content">{content}</div>}
          {showInput && (
            <div className="universal-dialog-input-container">
              <input
                type={inputType}
                value={currentInputValue}
                onChange={(e) => {
                  setCurrentInputValue(e.target.value);
                  if (onInputChange) {
                    onInputChange(e.target.value);
                  }
                }}
                placeholder={inputPlaceholder}
                className="universal-dialog-input"
                autoFocus
              />
            </div>
          )}
        </div>
        <div className="universal-dialog-actions">
          <button 
            className="universal-dialog-button cancel" 
            onClick={handleCancel}
          >
            {cancelText}
          </button>
          <button 
            className="universal-dialog-button confirm" 
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UniversalDialog;