import React from 'react';

/**
 * 认证页面布局
 * 简洁居中布局，包裹登录/注册页
 */
const AuthLayout = ({ children }) => {
  return (
    <div className="auth-layout min-h-screen">
      {children}
    </div>
  );
};

export default AuthLayout;
