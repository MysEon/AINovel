import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Tabs, Divider, Checkbox, Space, Alert, Spin } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, EyeOutlined, EyeInvisibleOutlined, GithubOutlined, WechatOutlined, GlobalOutlined, BulbOutlined, InfoCircleOutlined } from '@ant-design/icons';
import './AuthPage.css';

const { TabPane } = Tabs;

const AuthPage = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState('login');
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [language, setLanguage] = useState('zh');
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [error, setError] = useState(null);

  const calculatePasswordStrength = (password) => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    if (/[a-z]/.test(password)) strength += 12.5;
    if (/[A-Z]/.test(password)) strength += 12.5;
    if (/[0-9]/.test(password)) strength += 12.5;
    if (/[^A-Za-z0-9]/.test(password)) strength += 12.5;
    return Math.min(strength, 100);
  };

  const handlePasswordChange = (e) => {
    const password = e.target.value;
    setPasswordStrength(calculatePasswordStrength(password));
  };

  const toggleLanguage = () => {
    setLanguage(language === 'zh' ? 'en' : 'zh');
  };

  const handleSocialLogin = (provider) => {
    message.info(`${provider} 登录功能开发中`);
  };

  const handleForgotPassword = () => {
    message.info('忘记密码功能开发中');
  };

  const handleLogin = async (values) => {
    setIsLoginLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (response.ok) {
        message.success('登录成功');
        onLogin(data.access_token);
      } else {
        message.error(data.detail || '登录失败');
      }
    } catch (error) {
      message.error('网络错误，请稍后重试');
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleRegister = async (values) => {
    setIsRegisterLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (response.ok) {
        message.success('注册成功！请登录您的账户。');
        registerForm.resetFields();
        setActiveTab('login');
      } else {
        let errorMessage = '注册失败';
        if (data.detail) {
          if (typeof data.detail === 'string') {
            errorMessage = data.detail;
          } else if (Array.isArray(data.detail)) {
            errorMessage = data.detail[0]?.msg || errorMessage;
          } else if (typeof data.detail === 'object') {
            errorMessage = data.detail.msg || JSON.stringify(data.detail);
          }
        }
        message.error(errorMessage);
      }
    } catch (error) {
      message.error('网络错误，请稍后重试');
    } finally {
      setIsRegisterLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <Card className="auth-card" bordered={false}>
        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
            style={{ marginBottom: '24px' }}
          />
        )}
        
        <div className="auth-header">
          <h1>AINovel</h1>
          <p className="auth-subtitle">AI驱动的小说创作平台</p>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          className="auth-tabs"
        >
          <TabPane tab="登录" key="login">
            <Form
              form={loginForm}
              name="login"
              onFinish={handleLogin}
              autoComplete="off"
              className="auth-form"
            >
              <Form.Item
                name="username"
                rules={[{ required: true, message: '请输入用户名' }]}
                className="auth-input"
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="用户名"
                  size="large"
                  disabled={isLoginLoading}
                  bordered={false}
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
                className="auth-input"
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="密码"
                  size="large"
                  disabled={isLoginLoading}
                  iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
                  bordered={false}
                />
              </Form.Item>

              <Form.Item>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <Checkbox 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  >
                    记住我
                  </Checkbox>
                  <Button 
                    type="link" 
                    onClick={handleForgotPassword}
                    style={{ padding: 0, height: 'auto', color: 'white' }}
                  >
                    忘记密码？
                  </Button>
                </div>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={isLoginLoading}
                  block
                  size="large"
                  className="auth-button"
                >
                  登录
                </Button>
              </Form.Item>
            </Form>
          </TabPane>

          <TabPane tab="注册" key="register">
            <Form
              form={registerForm}
              name="register"
              onFinish={handleRegister}
              autoComplete="off"
              className="auth-form"
            >
              <Form.Item
                name="username"
                rules={[
                  { required: true, message: '请输入用户名' },
                  { min: 3, message: '用户名至少需要3个字符' },
                  { max: 50, message: '用户名不能超过50个字符' }
                ]}
                className="auth-input"
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="用户名"
                  size="large"
                  disabled={isRegisterLoading}
                  bordered={false}
                />
              </Form.Item>

              <Form.Item
                name="email"
                rules={[
                  { required: true, message: '请输入电子邮箱' },
                  { type: 'email', message: '请输入有效的邮箱地址' }
                ]}
                className="auth-input"
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="电子邮箱"
                  size="large"
                  disabled={isRegisterLoading}
                  bordered={false}
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 6, message: '密码至少需要6个字符' },
                  { max: 50, message: '密码不能超过50个字符' }
                ]}
                className="auth-input"
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="密码"
                  size="large"
                  disabled={isRegisterLoading}
                  iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
                  onChange={handlePasswordChange}
                  bordered={false}
                />
              </Form.Item>
              
              {passwordStrength > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', marginRight: '8px' }}>
                      密码强度: 
                    </span>
                    <div style={{ 
                      flex: 1, 
                      height: '4px', 
                      background: '#f0f0f0', 
                      borderRadius: '2px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        width: `${passwordStrength}%`, 
                        height: '100%', 
                        background: passwordStrength < 40 ? '#ff4d4f' : 
                                 passwordStrength < 70 ? '#faad14' : '#52c41a',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <span style={{ fontSize: '12px', marginLeft: '8px' }}>
                      {passwordStrength < 40 ? '弱' : 
                       passwordStrength < 70 ? '中' : '强'}
                    </span>
                  </div>
                </div>
              )}

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={isRegisterLoading}
                  block
                  size="large"
                  className="auth-button"
                >
                  注册
                </Button>
              </Form.Item>
            </Form>
          </TabPane>
        </Tabs>
        
        <Divider style={{ color: 'rgba(255,255,255,0.8)', borderTopColor: 'rgba(255,255,255,0.3)' }}>或</Divider>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Button
              icon={<GithubOutlined />}
              onClick={() => handleSocialLogin('GitHub')}
              size="large"
              style={{ flex: 1 }}
            >
              GitHub
            </Button>
            <Button
              icon={<WechatOutlined />}
              onClick={() => handleSocialLogin('微信')}
              size="large"
              style={{ flex: 1, background: '#07C160', borderColor: '#07C160', color: 'white' }}
            >
              微信
            </Button>
          </div>
        
        </Card>
      
      <div className="auth-footer">
        <div>
          AINovel v1.0.0 | AI驱动的小说创作平台
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '8px' }}>
          <Button
            type="text"
            icon={<GlobalOutlined />}
            onClick={toggleLanguage}
          >
            {language === 'zh' ? 'English' : '中文'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;