import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { FaPenNib, FaWandMagicSparkles, FaBookOpen } from 'react-icons/fa6';
import { login } from '../services/authService';
import './LoginPage.css';

const LoginPage = ({ onLogin, onNavigate }) => {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);

  const onFinish = async (values) => {
    setIsLoading(true);
    try {
      const data = await login(values);
      message.success('登录成功');
      onLogin(data.access_token);
    } catch (error) {
      message.error(error.message || '登录失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 font-sans">
      {/* 左侧：品牌信息和背景 (仅在中大屏幕显示) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-indigo-900 overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-40 mix-blend-multiply bg-cover bg-center login-bg-image"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/90 to-purple-800/90 z-10"></div>
        
        {/* 装饰性背景元素 */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-10 pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-white/5 blur-3xl"></div>
          <div className="absolute bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full bg-purple-500/10 blur-3xl"></div>
        </div>

        <div className="relative z-20 flex flex-col justify-between p-12 lg:p-16 w-full text-white">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-lg">
                <FaPenNib className="text-white text-xl" />
              </div>
              <span className="text-2xl font-bold tracking-tight">AINovel</span>
            </div>
            
            <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-6">
              释放你的<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-purple-300">
                无限创作潜能
              </span>
            </h1>
            <p className="text-lg text-indigo-100/80 max-w-md leading-relaxed">
              AI驱动的新一代小说创作平台。从世界观构建到章节生成，让每一个灵感都能绽放为精彩的故事。
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="mt-1 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <FaWandMagicSparkles className="text-blue-300" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">智能辅助创作</h3>
                <p className="text-sm text-indigo-200">强大的AI模型，懂你的创作风格，随时为你提供灵感和续写。</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-1 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <FaBookOpen className="text-purple-300" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">系统化知识库</h3>
                <p className="text-sm text-indigo-200">角色、设定、时间线... 完美管理你的小说世界观，永不吃书。</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧：登录表单 */}
      <div className="flex flex-col justify-center items-center w-full lg:w-1/2 p-6 sm:p-12 relative z-10 bg-white dark:bg-gray-900">
        <div className="w-full max-w-[400px]">
          {/* 移动端显示的Logo */}
          <div className="flex items-center justify-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
              <FaPenNib className="text-white text-xl" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">AINovel</span>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">欢迎回来</h2>
            <p className="text-gray-500 dark:text-gray-400">请输入您的账号信息以继续创作</p>
          </div>

          <Form
            form={form}
            name="login"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
            layout="vertical"
            className="modern-login-form"
            requiredMark={false}
          >
            <Form.Item
              name="username"
              label={<span className="text-gray-700 dark:text-gray-300 font-medium">用户名</span>}
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
                prefix={<UserOutlined className="text-gray-400" />}
                placeholder="请输入用户名"
                disabled={isLoading}
                className="hover:border-indigo-500 focus:border-indigo-500 rounded-lg px-4 py-3 bg-gray-50/50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 dark:text-white transition-all duration-200"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span className="text-gray-700 dark:text-gray-300 font-medium">密码</span>}
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder="请输入密码"
                disabled={isLoading}
                iconRender={(visible) => (visible ? <EyeOutlined className="text-gray-500" /> : <EyeInvisibleOutlined className="text-gray-400" />)}
                className="hover:border-indigo-500 focus:border-indigo-500 rounded-lg px-4 py-3 bg-gray-50/50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 dark:text-white transition-all duration-200"
              />
            </Form.Item>

            <div className="flex items-center justify-between mb-6 text-sm">
              <label className="flex items-center gap-2 cursor-pointer text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 bg-transparent" />
                <span>记住我</span>
              </label>
              <a href="#" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors">
                忘记密码？
              </a>
            </div>

            <Form.Item className="mb-6">
              <Button
                type="primary"
                htmlType="submit"
                loading={isLoading}
                block
                className="h-12 rounded-lg bg-indigo-600 hover:bg-indigo-700 border-none shadow-md shadow-indigo-200 dark:shadow-none text-base font-medium transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-lg hover:shadow-indigo-300 dark:hover:shadow-none"
              >
                登录账号
              </Button>
            </Form.Item>
          </Form>

          <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
            还没有账号？{' '}
            <a 
              href="#register" 
              onClick={(e) => { e.preventDefault(); onNavigate('register'); }} 
              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              立即免费注册
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
