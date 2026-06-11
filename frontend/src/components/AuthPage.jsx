import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Tabs, Divider, Checkbox, Switch } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, EyeOutlined, EyeInvisibleOutlined, GithubOutlined, WechatOutlined, SettingOutlined } from '@ant-design/icons';
import ParticleBackground, { SHAPE_LIST } from './ParticleBackground';
import { login, register } from '../services/authService';
import { STORAGE_KEYS } from '../services/core/authStorage';
import './AuthPage.css';

const { TabPane } = Tabs;

const AuthPage = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState('login');
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showShapeSettings, setShowShapeSettings] = useState(false);
  const [enabledShapes, setEnabledShapes] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PARTICLE_SHAPES);
      return saved ? JSON.parse(saved) : SHAPE_LIST.map(s => s.key);
    } catch { return SHAPE_LIST.map(s => s.key); }
  });

  const toggleShape = (key) => {
    setEnabledShapes(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      const result = next.length === 0 ? [key] : next; // at least one
      localStorage.setItem(STORAGE_KEYS.PARTICLE_SHAPES, JSON.stringify(result));
      return result;
    });
  };

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

  const handleSocialLogin = (provider) => {
    message.info(`${provider} 登录功能开发中`);
  };

  const handleForgotPassword = () => {
    message.info('忘记密码功能开发中');
  };

  const handleLogin = async (values) => {
    setIsLoginLoading(true);
    try {
      const data = await login(values);
      message.success('登录成功');
      onLogin(data.access_token);
    } catch (error) {
      message.error(error.message || '登录失败');
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleRegister = async (values) => {
    setIsRegisterLoading(true);
    try {
      await register(values);
      message.success('注册成功！请登录您的账户。');
      registerForm.resetFields();
      setActiveTab('login');
    } catch (error) {
      message.error(error.message || '注册失败');
    } finally {
      setIsRegisterLoading(false);
    }
  };

  const containerClass = isDarkMode ? "auth-container dark" : "auth-container light";

  return (
    <div className={containerClass}>
      <ParticleBackground isDarkMode={isDarkMode} enabledShapes={enabledShapes} />
      <div className="auth-wrapper">

        <div className="auth-brand">
          <div className="brand-icon">✦</div>
          <h1 className="brand-title">AINovel</h1>
          <p className="brand-slogan">用 AI 重新定义创作</p>
        </div>

        <div className="auth-spacer" />

        <Card className="auth-card" bordered={false}>

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
                <div className="auth-meta">
                  <Checkbox
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  >
                    记住我
                  </Checkbox>
                  <Button
                    type="link"
                    onClick={handleForgotPassword}
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
                <div className="pwd-strength">
                  <span>密码强度</span>
                  <div className="pwd-strength-bar">
                    <div className="pwd-strength-fill" style={{
                      width: `${passwordStrength}%`,
                      background: passwordStrength < 40 ? '#ff4d4f' :
                                 passwordStrength < 70 ? '#faad14' : '#52c41a',
                    }} />
                  </div>
                  <span>{passwordStrength < 40 ? '弱' : passwordStrength < 70 ? '中' : '强'}</span>
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
        
        <Divider className="auth-divider">或</Divider>
        <div className="auth-social">
            <Button
              icon={<GithubOutlined />}
              onClick={() => handleSocialLogin('GitHub')}
              size="large"
            >
              GitHub
            </Button>
            <Button
              icon={<WechatOutlined />}
              onClick={() => handleSocialLogin('微信')}
              size="large"
            >
              微信
            </Button>
          </div>
        
        </Card>
      
      <div className="auth-footer">
        <Switch checked={isDarkMode} onChange={setIsDarkMode} checkedChildren="🌙" unCheckedChildren="☀️" />
        <div style={{marginTop: '8px'}}>AINovel v1.0.0</div>
      </div>

      <div className="shape-settings">
        <button
          className="shape-settings-trigger"
          onClick={() => setShowShapeSettings(v => !v)}
          title="粒子形状设置"
        >
          <SettingOutlined spin={showShapeSettings} />
        </button>
        {showShapeSettings && (
          <div className="shape-settings-panel">
            <div className="shape-settings-title">粒子形状</div>
            {SHAPE_LIST.map(s => (
              <label key={s.key} className="shape-settings-item">
                <input
                  type="checkbox"
                  checked={enabledShapes.includes(s.key)}
                  onChange={() => toggleShape(s.key)}
                />
                <span>{s.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default AuthPage;