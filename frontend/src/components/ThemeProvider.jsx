import React, { createContext, useContext, useState, useEffect } from 'react';
import { ConfigProvider, theme } from 'antd';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // 检查系统主题偏好
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDark);
    
    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const lightTheme = {
    token: {
      colorPrimary: '#1a1a1a',
      colorBgContainer: '#ffffff',
      colorBgLayout: '#f5f5f5',
      colorBorder: '#e0e0e0',
      colorText: '#1a1a1a',
      colorTextSecondary: '#666',
      colorBgElevated: '#f8f9fa',
      borderRadius: 8,
    },
    components: {
      Button: {
        colorPrimary: '#1a1a1a',
        colorPrimaryHover: '#333333',
        colorPrimaryActive: '#1a1a1a',
        borderRadius: 8,
        controlHeight: 48,
      },
      Card: {
        borderRadius: 12,
        colorBgContainer: '#ffffff',
        colorBorderSecondary: '#e0e0e0',
      },
      Input: {
        borderRadius: 8,
        colorBorder: '#e0e0e0',
        colorPrimaryHover: '#667eea',
        activeBorderColor: '#667eea',
        activeShadow: '0 0 0 2px rgba(102, 126, 234, 0.1)',
      },
      Modal: {
        borderRadius: 16,
        contentBg: '#ffffff',
        headerBg: '#ffffff',
      },
      Statistic: {
        contentFontSize: 16,
        titleFontSize: 14,
      },
    },
  };

  const darkTheme = {
    token: {
      colorPrimary: '#ffffff',
      colorBgContainer: '#2d2d2d',
      colorBgLayout: '#1a1a1a',
      colorBorder: '#404040',
      colorText: '#ffffff',
      colorTextSecondary: '#cccccc',
      colorBgElevated: '#3d3d3d',
      borderRadius: 8,
    },
    components: {
      Button: {
        colorPrimary: '#ffffff',
        colorPrimaryHover: '#f0f0f0',
        colorPrimaryActive: '#ffffff',
        borderRadius: 8,
        controlHeight: 48,
      },
      Card: {
        borderRadius: 12,
        colorBgContainer: '#2d2d2d',
        colorBorderSecondary: '#404040',
      },
      Input: {
        borderRadius: 8,
        colorBorder: '#505050',
        colorPrimaryHover: '#666666',
        activeBorderColor: '#666666',
        activeShadow: '0 0 0 2px rgba(102, 102, 102, 0.1)',
      },
      Modal: {
        borderRadius: 16,
        contentBg: '#2d2d2d',
        headerBg: '#2d2d2d',
      },
      Statistic: {
        contentFontSize: 16,
        titleFontSize: 14,
      },
    },
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const currentTheme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      <ConfigProvider theme={currentTheme}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};