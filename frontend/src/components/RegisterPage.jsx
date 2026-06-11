import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { useNotification } from './NotificationManager';
import { register } from '../services/authService';

const RegisterPage = ({ onNavigate }) => {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const { addNotification } = useNotification();

  const onFinish = async (values) => {
    setIsLoading(true);
    try {
      await register(values);
      message.success('注册成功！请登录您的账户。');
      setTimeout(() => { onNavigate('login'); }, 1500);
    } catch (error) {
      message.error(error.message || '注册失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-background">
        <div className="background-pattern"></div>
      </div>
      
      <div className="login-container">
        <Card className="login-card">
          <div className="login-header">
            <h1>创建账户</h1>
            <p>加入AINovel，开始您的创作之旅</p>
          </div>

          <Form
            form={form}
            name="register"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少需要3个字符' },
                { max: 50, message: '用户名不能超过50个字符' }
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="用户名"
                disabled={isLoading}
              />
            </Form.Item>

            <Form.Item
              name="email"
              rules={[
                { required: true, message: '请输入电子邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' }
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="电子邮箱"
                disabled={isLoading}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少需要6个字符' },
                { max: 50, message: '密码不能超过50个字符' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
                disabled={isLoading}
                iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={isLoading}
                block
                size="large"
              >
                注册
              </Button>
            </Form.Item>
          </Form>

          <div className="login-footer">
            <p>已有账号？<a href="#login" onClick={() => onNavigate('login')}>返回登录</a></p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;
