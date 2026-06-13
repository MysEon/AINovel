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

const AUTO_REALM_INTERVAL_MS = 9000;

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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveRealm((currentRealm) => {
        const currentIndex = SHAPE_LIST.findIndex((item) => item.key === currentRealm);
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % SHAPE_LIST.length;
        return SHAPE_LIST[nextIndex].key;
      });
    }, AUTO_REALM_INTERVAL_MS);

    return () => window.clearInterval(timer);
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

      </section>

      <section className="auth-scroll-typography" aria-label="创作能力关键词">
        <div className="kinetic-word kinetic-world">
          <span>世界观</span>
          <small>World state</small>
        </div>
        <div className="kinetic-word kinetic-magic">
          <span>魔法</span>
          <small>Arcane logic</small>
        </div>
        <div className="kinetic-word kinetic-tech">
          <span>科技</span>
          <small>Model engine</small>
        </div>
        <div className="kinetic-word kinetic-write">
          <span>写作</span>
          <small>Draft faster</small>
        </div>
        <div className="kinetic-center-copy">
          <span>Novel OS</span>
          <p>把设定、章节、提示词和模型协作放在同一个冷静的创作系统里。</p>
        </div>
      </section>

      <section className="auth-product-flow" aria-label="AINovel 工作流">
        <div className="auth-flow-lead">
          <span>Build the universe first</span>
          <h2>不是写作软件加一个聊天框，而是一套小说项目操作系统。</h2>
        </div>
        <div className="auth-flow-rows">
          <article>
            <span>01</span>
            <h3>项目中枢</h3>
            <p>章节、角色、地点、组织和世界观统一归档，长篇项目不再散落在多个文档里。</p>
          </article>
          <article>
            <span>02</span>
            <h3>AI 协作</h3>
            <p>按写作阶段切换提示词、模型和上下文，让 AI 更像稳定的创作搭档。</p>
          </article>
          <article>
            <span>03</span>
            <h3>连续创作</h3>
            <p>从大纲到正文再到校对，功能区服务文本流动，界面保持克制和高密度。</p>
          </article>
        </div>
      </section>

      <section className="auth-system-strip" aria-label="创作系统能力">
        <div>
          <span>Prompt Library</span>
          <strong>提示词沉淀</strong>
        </div>
        <div>
          <span>Knowledge Graph</span>
          <strong>知识库联动</strong>
        </div>
        <div>
          <span>Draft Studio</span>
          <strong>正文工作台</strong>
        </div>
        <div>
          <span>Review Loop</span>
          <strong>设定校对</strong>
        </div>
      </section>

      <section className="auth-bottom-cta">
        <span>AINovel</span>
        <h2>开始把你的世界写成系统。</h2>
        <Button type="primary" size="large" onClick={() => openAuth('register')}>
          创建新账号
        </Button>
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
