import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Checkbox, Divider, Form, Input, message, Modal, Switch, Tabs } from 'antd';
import {
  ArrowRightOutlined,
  GithubOutlined,
  LockOutlined,
  MailOutlined,
  RadarChartOutlined,
  UserOutlined,
  WechatOutlined,
} from '@ant-design/icons';
import ParticleBackground, { SHAPE_LIST } from './ParticleBackground';
import { useTheme } from './ThemeProvider';
import { useAuth } from '../contexts/AuthContext';
import { login, register } from '../services/authService';
import './AuthPage.css';

const strengthLabels = {
  0: '待输入',
  25: '较弱',
  50: '可用',
  75: '稳定',
  100: '强',
};

const AuthPage = () => {
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const { isDarkMode, setThemeMode } = useTheme();
  const [activeTab, setActiveTab] = useState('login');
  const [authOpen, setAuthOpen] = useState(false);
  const [activeRealm, setActiveRealm] = useState('fantasy');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [rememberMe, setRememberMe] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();

  useEffect(() => {
    const handleScroll = () => {
      const scrollable = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      setScrollProgress(Math.min(window.scrollY / scrollable, 1));
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const activeRealmInfo = useMemo(
    () => SHAPE_LIST.find((item) => item.key === activeRealm) || SHAPE_LIST[0],
    [activeRealm]
  );

  const openAuth = (tab) => {
    setActiveTab(tab);
    setAuthOpen(true);
  };

  const calculatePasswordStrength = (password) => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) strength += 25;
    return Math.min(strength, 100);
  };

  const handlePasswordChange = (event) => {
    setPasswordStrength(calculatePasswordStrength(event.target.value));
  };

  const handleSocialLogin = (provider) => {
    message.info(`${provider} 登录功能开发中`);
  };

  const handleLogin = async (values) => {
    setIsLoginLoading(true);
    try {
      const data = await login(values);
      message.success('登录成功');
      await authLogin(data.access_token);
      navigate('/dashboard');
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
      message.success('注册成功，请登录');
      registerForm.resetFields();
      setActiveTab('login');
    } catch (error) {
      message.error(error.message || '注册失败');
    } finally {
      setIsRegisterLoading(false);
    }
  };

  const strengthLevel = Math.ceil(passwordStrength / 25) * 25;

  const loginFormContent = (
    <Form
      form={loginForm}
      name="login"
      onFinish={handleLogin}
      autoComplete="off"
      className="auth-form"
      layout="vertical"
    >
      <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
        <Input prefix={<UserOutlined />} placeholder="输入用户名" size="large" disabled={isLoginLoading} />
      </Form.Item>

      <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
        <Input.Password prefix={<LockOutlined />} placeholder="输入密码" size="large" disabled={isLoginLoading} />
      </Form.Item>

      <div className="auth-meta">
        <Checkbox checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)}>
          记住我
        </Checkbox>
        <Button type="link" onClick={() => message.info('忘记密码功能开发中')}>
          忘记密码？
        </Button>
      </div>

      <Button type="primary" htmlType="submit" loading={isLoginLoading} block size="large" className="auth-submit">
        登录工作台
      </Button>
    </Form>
  );

  const registerFormContent = (
    <Form
      form={registerForm}
      name="register"
      onFinish={handleRegister}
      autoComplete="off"
      className="auth-form"
      layout="vertical"
    >
      <Form.Item
        name="username"
        label="用户名"
        rules={[
          { required: true, message: '请输入用户名' },
          { min: 3, message: '用户名至少需要 3 个字符' },
          { max: 50, message: '用户名不能超过 50 个字符' },
        ]}
      >
        <Input prefix={<UserOutlined />} placeholder="创建用户名" size="large" disabled={isRegisterLoading} />
      </Form.Item>

      <Form.Item
        name="email"
        label="邮箱"
        rules={[
          { required: true, message: '请输入邮箱' },
          { type: 'email', message: '请输入有效邮箱地址' },
        ]}
      >
        <Input prefix={<MailOutlined />} placeholder="name@example.com" size="large" disabled={isRegisterLoading} />
      </Form.Item>

      <Form.Item
        name="password"
        label="密码"
        rules={[
          { required: true, message: '请输入密码' },
          { min: 6, message: '密码至少需要 6 个字符' },
          { max: 50, message: '密码不能超过 50 个字符' },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="设置密码"
          size="large"
          disabled={isRegisterLoading}
          onChange={handlePasswordChange}
        />
      </Form.Item>

      <div className={`pwd-strength strength-${strengthLevel}`}>
        <span>密码强度</span>
        <div className="pwd-strength-bar">
          <div className="pwd-strength-fill" />
        </div>
        <span>{strengthLabels[strengthLevel] || strengthLabels[0]}</span>
      </div>

      <Button type="primary" htmlType="submit" loading={isRegisterLoading} block size="large" className="auth-submit">
        创建账号
      </Button>
    </Form>
  );

  return (
    <main className={`auth-container ${isDarkMode ? 'dark' : 'light'}`}>
      <ParticleBackground isDarkMode={isDarkMode} activeRealm={activeRealm} scrollProgress={scrollProgress} />

      <header className="auth-nav">
        <div className="auth-nav-brand">
          <span className="auth-nav-mark">
            <RadarChartOutlined />
          </span>
          <span>AINovel</span>
        </div>
        <div className="auth-nav-actions">
          <Switch
            checked={isDarkMode}
            onChange={(checked) => setThemeMode(checked ? 'dark' : 'light')}
            checkedChildren="暗"
            unCheckedChildren="亮"
          />
          <Button className="auth-nav-button" onClick={() => openAuth('login')}>
            登录
          </Button>
          <Button type="primary" className="auth-nav-button primary" onClick={() => openAuth('register')}>
            注册
          </Button>
        </div>
      </header>

      <section className="auth-hero">
        <div className="auth-hero-copy">
          <span className="auth-kicker">{activeRealmInfo.label}</span>
          <h1>把灵感、设定和 AI 写作组织成一张创作星图。</h1>
          <p>
            AINovel 将小说项目、角色设定、世界观、提示词和多模型协作放在同一个清爽工作台里，
            让想象力保持流动，管理保持克制。
          </p>
          <div className="auth-hero-actions">
            <Button type="primary" size="large" onClick={() => openAuth('login')}>
              进入工作台 <ArrowRightOutlined />
            </Button>
            <Button size="large" onClick={() => openAuth('register')}>
              创建新账号
            </Button>
          </div>
        </div>

        <div className="realm-switcher" aria-label="切换登录页元素风格">
          {SHAPE_LIST.map((realm) => (
            <button
              key={realm.key}
              className={realm.key === activeRealm ? 'active' : ''}
              onClick={() => setActiveRealm(realm.key)}
              type="button"
            >
              <span>{realm.name}</span>
              <small>{realm.label}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="auth-scroll-story">
        <div className="story-card story-card-primary">
          <span>01</span>
          <h2>设定沉淀</h2>
          <p>把角色、组织、地点、世界规则沉淀成可检索资产，写作时随时调用。</p>
        </div>
        <div className="story-card story-card-secondary">
          <span>02</span>
          <h2>多模型协作</h2>
          <p>按场景切换模型、提示词和工作流，让 AI 成为稳定的创作伙伴。</p>
        </div>
        <div className="story-card story-card-tertiary">
          <span>03</span>
          <h2>专注写作</h2>
          <p>项目内界面回归简洁科技风，减少装饰噪音，把空间留给文本。</p>
        </div>
      </section>

      <Modal
        open={authOpen}
        footer={null}
        centered
        width={460}
        onCancel={() => setAuthOpen(false)}
        className="auth-glass-modal"
        rootClassName="auth-glass-modal-root"
      >
        <div className="auth-modal-head">
          <span>AINovel Access</span>
          <h2>{activeTab === 'login' ? '欢迎回来' : '开始创作'}</h2>
          <p>{activeTab === 'login' ? '登录后继续你的小说项目。' : '创建账号，建立你的第一套创作系统。'}</p>
        </div>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          items={[
            { key: 'login', label: '登录', children: loginFormContent },
            { key: 'register', label: '注册', children: registerFormContent },
          ]}
        />
        <Divider className="auth-divider">或</Divider>
        <div className="auth-social">
          <Button icon={<GithubOutlined />} onClick={() => handleSocialLogin('GitHub')}>
            GitHub
          </Button>
          <Button icon={<WechatOutlined />} onClick={() => handleSocialLogin('微信')}>
            微信
          </Button>
        </div>
      </Modal>
    </main>
  );
};

export default AuthPage;
