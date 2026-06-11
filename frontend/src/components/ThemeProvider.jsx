import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { antdTokens } from '../theme/tokens';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const STORAGE_KEY = 'ainovel_theme_mode';

const getStoredMode = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'system' || stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'dark'; // 默认暗色（沉浸写作风主推）
};

const getSystemTheme = () => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const resolveEffectiveMode = (mode) => {
  if (mode === 'system') {
    return getSystemTheme();
  }
  return mode;
};

export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeModeState] = useState(getStoredMode);
  const [systemMode, setSystemMode] = useState(getSystemTheme);

  const effectiveMode = resolveEffectiveMode(themeMode);
  const isDarkMode = effectiveMode === 'dark';

  // 持久化主题选择
  const setThemeMode = useCallback((mode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  // 切换主题（system -> light -> dark -> system）
  const toggleTheme = useCallback(() => {
    const order = ['system', 'light', 'dark'];
    const idx = order.indexOf(themeMode);
    const next = order[(idx + 1) % order.length];
    setThemeMode(next);
  }, [themeMode, setThemeMode]);

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemMode(e.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // 同步 class 到 DOM，保持与旧组件 CSS 的兼容性
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    if (isDarkMode) {
      html.classList.add('dark');
      html.classList.remove('light');
      body.classList.add('dark-theme');
      body.classList.remove('light-theme');
    } else {
      html.classList.remove('dark');
      html.classList.add('light');
      body.classList.remove('dark-theme');
      body.classList.add('light-theme');
    }
  }, [isDarkMode]);

  const currentTheme = useMemo(() => {
    const tokens = isDarkMode ? antdTokens.dark : antdTokens.light;
    return {
      algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      ...tokens,
    };
  }, [isDarkMode]);

  const value = useMemo(() => ({
    themeMode,
    effectiveMode,
    isDarkMode,
    setThemeMode,
    toggleTheme,
  }), [themeMode, effectiveMode, isDarkMode, setThemeMode, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={currentTheme}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};
