// 设计 Token —— SSOT，供 AntD ConfigProvider 与业务组件统一消费
// 暗色：沉浸写作风（深灰底 + 琥珀 accent）
// 亮色：清爽阅读风（白底 + 蓝 accent）

export const colors = {
  dark: {
    bgPrimary: '#0d1117',
    bgSecondary: '#161b22',
    bgElevated: '#21262d',
    fgPrimary: '#e6edf3',
    fgSecondary: '#8b949e',
    fgMuted: '#484f58',
    accent: '#d4940a',
    accentHover: '#e5a820',
    accentPressed: '#b37d08',
    border: '#30363d',
    success: '#2ea043',
    warning: '#d29922',
    error: '#f85149',
  },
  light: {
    bgPrimary: '#ffffff',
    bgSecondary: '#f6f8fa',
    bgElevated: '#ffffff',
    fgPrimary: '#1f2328',
    fgSecondary: '#656d76',
    fgMuted: '#8c959f',
    accent: '#0969da',
    accentHover: '#0550ae',
    accentPressed: '#033d8b',
    border: '#d0d7de',
    success: '#2ea043',
    warning: '#d29922',
    error: '#f85149',
  },
};

export const antdTokens = {
  dark: {
    token: {
      colorPrimary: colors.dark.accent,
      colorBgContainer: colors.dark.bgElevated,
      colorBgLayout: colors.dark.bgPrimary,
      colorBorder: colors.dark.border,
      colorText: colors.dark.fgPrimary,
      colorTextSecondary: colors.dark.fgSecondary,
      colorBgElevated: colors.dark.bgElevated,
      borderRadius: 8,
      colorSuccess: colors.dark.success,
      colorWarning: colors.dark.warning,
      colorError: colors.dark.error,
      colorLink: colors.dark.accent,
      colorLinkHover: colors.dark.accentHover,
    },
    components: {
      Button: {
        colorPrimary: colors.dark.accent,
        colorPrimaryHover: colors.dark.accentHover,
        colorPrimaryActive: colors.dark.accentPressed,
        borderRadius: 8,
        controlHeight: 40,
      },
      Card: {
        borderRadius: 12,
        colorBgContainer: colors.dark.bgElevated,
        colorBorderSecondary: colors.dark.border,
      },
      Input: {
        borderRadius: 8,
        colorBorder: colors.dark.border,
        colorPrimaryHover: colors.dark.accent,
        activeBorderColor: colors.dark.accent,
        activeShadow: `0 0 0 2px ${colors.dark.accent}33`,
      },
      Modal: {
        borderRadius: 12,
        contentBg: colors.dark.bgElevated,
        headerBg: colors.dark.bgSecondary,
      },
      Menu: {
        colorBgContainer: 'transparent',
        colorItemBgSelected: colors.dark.accent,
        colorItemTextSelected: '#ffffff',
      },
      Statistic: {
        contentFontSize: 16,
        titleFontSize: 14,
      },
    },
  },
  light: {
    token: {
      colorPrimary: colors.light.accent,
      colorBgContainer: colors.light.bgElevated,
      colorBgLayout: colors.light.bgPrimary,
      colorBorder: colors.light.border,
      colorText: colors.light.fgPrimary,
      colorTextSecondary: colors.light.fgSecondary,
      colorBgElevated: colors.light.bgElevated,
      borderRadius: 8,
      colorSuccess: colors.light.success,
      colorWarning: colors.light.warning,
      colorError: colors.light.error,
      colorLink: colors.light.accent,
      colorLinkHover: colors.light.accentHover,
    },
    components: {
      Button: {
        colorPrimary: colors.light.accent,
        colorPrimaryHover: colors.light.accentHover,
        colorPrimaryActive: colors.light.accentPressed,
        borderRadius: 8,
        controlHeight: 40,
      },
      Card: {
        borderRadius: 12,
        colorBgContainer: colors.light.bgElevated,
        colorBorderSecondary: colors.light.border,
      },
      Input: {
        borderRadius: 8,
        colorBorder: colors.light.border,
        colorPrimaryHover: colors.light.accent,
        activeBorderColor: colors.light.accent,
        activeShadow: `0 0 0 2px ${colors.light.accent}33`,
      },
      Modal: {
        borderRadius: 12,
        contentBg: colors.light.bgElevated,
        headerBg: colors.light.bgSecondary,
      },
      Menu: {
        colorBgContainer: 'transparent',
        colorItemBgSelected: colors.light.accent,
        colorItemTextSelected: '#ffffff',
      },
      Statistic: {
        contentFontSize: 16,
        titleFontSize: 14,
      },
    },
  },
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
};

export const fontFamily =
  'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';

export const shadows = {
  dark: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    md: '0 4px 12px rgba(0, 0, 0, 0.4)',
    lg: '0 12px 32px rgba(0, 0, 0, 0.5)',
  },
  light: {
    sm: '0 1px 2px rgba(31, 35, 40, 0.04)',
    md: '0 4px 12px rgba(31, 35, 40, 0.08)',
    lg: '0 12px 32px rgba(31, 35, 40, 0.12)',
  },
};
