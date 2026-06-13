// Design tokens consumed by Ant Design and custom CSS variables.

export const colors = {
  light: {
    bgPrimary: '#f7f7f5',
    bgSecondary: '#f3f4f6',
    bgElevated: '#ffffff',
    paperFiber: 'rgba(96, 165, 250, 0.08)',
    sealSoft: 'rgba(16, 163, 127, 0.1)',
    fgPrimary: '#101114',
    fgSecondary: '#5f6368',
    fgMuted: '#8a8f98',
    accent: '#111827',
    accentHover: '#0f172a',
    accentPressed: '#020617',
    border: '#e4e7ec',
    success: '#10a37f',
    warning: '#d97706',
    error: '#dc2626',
  },
  dark: {
    bgPrimary: '#0b0c0f',
    bgSecondary: '#111318',
    bgElevated: '#17191f',
    paperFiber: 'rgba(96, 165, 250, 0.12)',
    sealSoft: 'rgba(16, 163, 127, 0.14)',
    fgPrimary: '#f4f4f5',
    fgSecondary: '#a1a1aa',
    fgMuted: '#71717a',
    accent: '#10a37f',
    accentHover: '#19c499',
    accentPressed: '#0e8f70',
    border: '#272a33',
    success: '#10a37f',
    warning: '#f59e0b',
    error: '#f87171',
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
      borderRadius: 12,
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
        borderRadius: 12,
        controlHeight: 40,
      },
      Card: {
        borderRadius: 16,
        colorBgContainer: colors.dark.bgElevated,
        colorBorderSecondary: colors.dark.border,
      },
      Input: {
        borderRadius: 12,
        colorBorder: colors.dark.border,
        colorPrimaryHover: colors.dark.accent,
        activeBorderColor: colors.dark.accent,
        activeShadow: `0 0 0 2px ${colors.dark.accent}33`,
      },
      Modal: {
        borderRadius: 18,
        contentBg: colors.dark.bgElevated,
        headerBg: colors.dark.bgElevated,
      },
      Menu: {
        colorBgContainer: 'transparent',
        colorItemBgSelected: '#f4f4f5',
        colorItemTextSelected: '#0b0c0f',
      },
      Statistic: {
        contentFontSize: 16,
        titleFontSize: 13,
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
      borderRadius: 12,
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
        borderRadius: 12,
        controlHeight: 40,
      },
      Card: {
        borderRadius: 16,
        colorBgContainer: colors.light.bgElevated,
        colorBorderSecondary: colors.light.border,
      },
      Input: {
        borderRadius: 12,
        colorBorder: colors.light.border,
        colorPrimaryHover: colors.light.accent,
        activeBorderColor: colors.light.accent,
        activeShadow: `0 0 0 2px ${colors.light.accent}22`,
      },
      Modal: {
        borderRadius: 18,
        contentBg: colors.light.bgElevated,
        headerBg: colors.light.bgElevated,
      },
      Menu: {
        colorBgContainer: 'transparent',
        colorItemBgSelected: colors.light.accent,
        colorItemTextSelected: '#ffffff',
      },
      Statistic: {
        contentFontSize: 16,
        titleFontSize: 13,
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

export const displayFontFamily =
  'Inter, system-ui, -apple-system, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';

export const literaryFontFamily =
  'Inter, system-ui, -apple-system, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';

export const shadows = {
  dark: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.35)',
    md: '0 12px 30px rgba(0, 0, 0, 0.42)',
    lg: '0 26px 80px rgba(0, 0, 0, 0.5)',
  },
  light: {
    sm: '0 1px 2px rgba(17, 24, 39, 0.05)',
    md: '0 10px 24px rgba(17, 24, 39, 0.08)',
    lg: '0 24px 70px rgba(17, 24, 39, 0.12)',
  },
};
