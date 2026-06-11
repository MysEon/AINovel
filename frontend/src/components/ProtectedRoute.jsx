import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from '../services/core/authStorage';

/**
 * 受保护路由组件
 * 检查 auth token，未登录重定向到 /login
 */
const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const authenticated = isAuthenticated();

  if (!authenticated) {
    // 保存当前路径，登录后可跳转回来
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default ProtectedRoute;
