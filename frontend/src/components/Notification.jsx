import React, { useState, useEffect } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes } from 'react-icons/fa';
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
        return <FaCheckCircle className="notification-icon success" />;
      case 'error':
        return <FaExclamationCircle className="notification-icon error" />;
      case 'warning':
        return <FaExclamationCircle className="notification-icon warning" />;
      default:
        return <FaInfoCircle className="notification-icon info" />;
    }
  };

  const getTypeClass = () => {
    switch (type) {
      case 'success':
        return 'notification-success';
      case 'error':
        return 'notification-error';
      case 'warning':
        return 'notification-warning';
      default:
        return 'notification-info';
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`notification ${getTypeClass()}`}>
      <div className="notification-content">
        {getIcon()}
        <span className="notification-message">{message}</span>
        <button className="notification-close" onClick={handleClose}>
          <FaTimes />
        </button>
      </div>
    </div>
  );
};

export default Notification;