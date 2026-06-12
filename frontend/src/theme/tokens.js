// 设计 Token —— SSOT，供 AntD ConfigProvider 与业务组件统一消费
// 暗色：墨韵·Ink & Moonlight（深墨底 + 暖赭 accent）
// 亮色：宣纸白底 + 赭石 accent

export const colors = {
  light: {
    bgPrimary: '#FAF8F5',
    bgSecondary: '#F0EBE3',
    bgElevated: '#FFFFFF',
    paperFiber: 'rgba(199, 91, 57, 0.06)',
    sealSoft: 'rgba(199, 91, 57, 0.1)',
    fgPrimary: '#2C2825',
    fgSecondary: '#7A6E63',
    fgMuted: '#9B8E82',
    accent: '#C75B39',
    accentHover: '#B5502F',
    accentPressed: '#9E4528',
    border: '#DDD5CA',
    success: '#5A8F5C',
    warning: '#C4922E',
    error: '#C4463A',
  },
  dark: {
    bgPrimary: '#1A1714',
    bgSecondary: '#222019',
    bgElevated: '#2A2520',
    paperFiber: 'rgba(212, 145, 92, 0.08)',
    sealSoft: 'rgba(212, 145, 92, 0.14)',
    fgPrimary: '#E8E0D6',
    fgSecondary: '#A89B8E',
    fgMuted: '#7A6E63',
    accent: '#D4915C',
    accentHover: '#E0A06E',
    accentPressed: '#B87D4E',
    border: '#3D3630',
    success: '#6AAF6C',
    warning: '#D4A43E',
    error: '#E05A4E',
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
      borderRadius: 10,
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
        borderRadius: 10,
        controlHeight: 40,
      },
      Card: {
        borderRadius: 16,
        colorBgContainer: colors.dark.bgElevated,
        colorBorderSecondary: colors.dark.border,
      },
      Input: {
        borderRadius: 10,
        colorBorder: colors.dark.border,
        colorPrimaryHover: colors.dark.accent,
        activeBorderColor: colors.dark.accent,
        activeShadow: `0 0 0 2px ${colors.dark.accent}33`,
      },
      Modal: {
        borderRadius: 16,
        contentBg: colors.dark.bgElevated,
        headerBg: colors.dark.bgSecondary,
      },
      Menu: {
        colorBgContainer: 'transparent',
        colorItemBgSelected: colors.dark.accent,
        colorItemTextSelected: '#1A1714',
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
      borderRadius: 10,
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
        borderRadius: 10,
        controlHeight: 40,
      },
      Card: {
        borderRadius: 16,
        colorBgContainer: colors.light.bgElevated,
        colorBorderSecondary: colors.light.border,
      },
      Input: {
        borderRadius: 10,
        colorBorder: colors.light.border,
        colorPrimaryHover: colors.light.accent,
        activeBorderColor: colors.light.accent,
        activeShadow: `0 0 0 2px ${colors.light.accent}33`,
      },
      Modal: {
        borderRadius: 16,
        contentBg: colors.light.bgElevated,
        headerBg: colors.light.bgSecondary,
      },
      Menu: {
        colorBgContainer: 'transparent',
        colorItemBgSelected: colors.light.accent,
        colorItemTextSelected: '#FFFFFF',
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
  md: 10,
  lg: 16,
};

export const fontFamily =
  'Inter, system-ui, -apple-system, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';

export const displayFontFamily = '"Noto Serif SC", "Source Han Serif SC", Georgia, serif';
export const literaryFontFamily = '"LXGW WenKai", "霞鹜文楷", "KaiTi", serif';

export const shadows = {
  dark: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    md: '0 4px 12px rgba(0, 0, 0, 0.4)',
    lg: '0 12px 32px rgba(0, 0, 0, 0.5)',
  },
  light: {
    sm: '0 1px 2px rgba(44, 40, 37, 0.05)',
    md: '0 4px 12px rgba(44, 40, 37, 0.08)',
    lg: '0 12px 32px rgba(44, 40, 37, 0.12)',
  },
};
