import React, { useState } from 'react';
import { FaUser, FaLock, FaEnvelope, FaEye, FaEyeSlash } from 'react-icons/fa';
import { useNotification } from './NotificationManager';

const RegisterPage = ({ onNavigate }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
    setSuccess('');
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
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>创建账户</h1>
          <p>加入AINovel，开始您的创作之旅</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <div className="input-wrapper">
              <FaUser className="input-icon" />
              <input
                type="text"
                placeholder="用户名"
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
                required
              />
            </div>
            {usernameError && <div className="error-message">{usernameError}</div>}
          </div>

          <div className="form-group">
            <div className="input-wrapper">
              <FaEnvelope className="input-icon" />
              <input
                type="email"
                placeholder="电子邮箱"
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
                required
              />
            </div>
            {emailError && <div className="error-message">{emailError}</div>}
          </div>

          <div className="form-group">
            <div className="input-wrapper">
              <FaLock className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="密码"
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
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {passwordError && <div className="error-message">{passwordError}</div>}
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button 
            type="submit" 
            className="login-btn"
            disabled={isLoading}
          >
            {isLoading ? '注册中...' : '注册'}
          </button>
        </form>

        <div className="login-footer">
          <p>已有账号？<a href="#login" onClick={() => onNavigate('login')}>返回登录</a></p>
        </div>
      </div>

      <div className="login-background">
        <div className="background-pattern"></div>
      </div>
    </div>
  );
};

export default RegisterPage;
