import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * 仪表盘布局
 * 顶部导航 + 内容区，当前保持简洁，内容主要由 ProjectDashboard 自身渲染头部
 */
const DashboardLayout = () => {
  return (
    <div className="dashboard-layout min-h-screen">
      <Outlet />
    </div>
  );
};

export default DashboardLayout;
