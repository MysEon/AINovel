import React from 'react';

const ConfirmationDialog = ({ title, message, onConfirm, onCancel, confirmText = '确认', cancelText = '取消' }) => {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        <p>{message}</p>
        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={onCancel}>
            {cancelText}
          </button>
          <button type="button" className="confirm-btn" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;
