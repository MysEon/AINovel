import { createSystem, defineConfig, defaultConfig } from "@chakra-ui/react"

// 定义自定义主题配置
const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        // 品牌色彩
        brand: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9", // 主品牌色
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },
        // 创作相关的主题色
        creative: {
          50: "#fefce8",
          100: "#fef9c3",
          200: "#fef08a",
          300: "#fde047",
          400: "#facc15",
          500: "#eab308", // 创意黄色
          600: "#ca8a04",
          700: "#a16207",
          800: "#854d0e",
          900: "#713f12",
        },
        // 知识库主题色
        knowledge: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e", // 知识绿色
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
      },
      fonts: {
        heading: { value: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" },
        body: { value: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" },
      },
      spacing: {
        // 自定义间距
        px: "1px",
        0.5: "0.125rem",
        1: "0.25rem",
        2: "0.5rem",
        3: "0.75rem",
        4: "1rem",
        5: "1.25rem",
        6: "1.5rem",
        7: "1.75rem",
        8: "2rem",
        9: "2.25rem",
        10: "2.5rem",
        12: "3rem",
        16: "4rem",
        20: "5rem",
        24: "6rem",
        32: "8rem",
        40: "10rem",
        48: "12rem",
        56: "14rem",
        64: "16rem",
        80: "20rem",
        96: "24rem",
      },
      borderRadius: {
        none: "0",
        sm: "0.125rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
        full: "9999px",
      },
    },
    semanticTokens: {
      colors: {
        // 语义化颜色映射
        primary: { value: "{colors.brand.500}" },
        "primary.hover": { value: "{colors.brand.600}" },
        secondary: { value: "{colors.creative.500}" },
        success: { value: "{colors.knowledge.500}" },
        danger: { value: "{colors.red.500}" },
        warning: { value: "{colors.creative.500}" },
        info: { value: "{colors.brand.500}" },
        
        // 背景色
        bg: { value: "{colors.white}" },
        "bg.hover": { value: "{colors.gray.50}" },
        "bg.subtle": { value: "{colors.gray.100}" },
        
        // 边框色
        border: { value: "{colors.gray.200}" },
        "border.emphasis": { value: "{colors.gray.300}" },
        
        // 文字色
        text: { value: "{colors.gray.900}" },
        "text.subtle": { value: "{colors.gray.600}" },
        "text.muted": { value: "{colors.gray.500}" },
        "text.inverse": { value: "{colors.white}" },
      },
    },
  },
  // 全局样式
  globalCss: {
    "html, body": {
      margin: 0,
      padding: 0,
      fontFamily: "body",
      backgroundColor: "bg",
      color: "text",
      lineHeight: 1.5,
    },
    "*": {
      boxSizing: "border-box",
    },
  },
})

// 创建系统
export const system = createSystem(defaultConfig, config)