import { defineConfig } from "@chakra-ui/react"

export const system = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: "#eff6ff" },
          100: { value: "#dbeafe" },
          200: { value: "#bfdbfe" },
          300: { value: "#93c5fd" },
          400: { value: "#60a5fa" },
          500: { value: "#3b82f6" },
          600: { value: "#2563eb" },
          700: { value: "#1d4ed8" },
          800: { value: "#1e40af" },
          900: { value: "#1e3a8a" },
        },
        creative: {
          50: { value: "#fffbeb" },
          100: { value: "#fef3c7" },
          200: { value: "#fde68a" },
          300: { value: "#fcd34d" },
          400: { value: "#fbbf24" },
          500: { value: "#f59e0b" },
          600: { value: "#d97706" },
          700: { value: "#b45309" },
          800: { value: "#92400e" },
          900: { value: "#78350f" },
        },
        knowledge: {
          50: { value: "#f0fdf4" },
          100: { value: "#dcfce7" },
          200: { value: "#bbf7d0" },
          300: { value: "#86efac" },
          400: { value: "#4ade80" },
          500: { value: "#22c55e" },
          600: { value: "#16a34a" },
          700: { value: "#15803d" },
          800: { value: "#166534" },
          900: { value: "#14532d" },
        },
      },
    },
    semanticTokens: {
      colors: {
        text: {
          primary: { value: "{colors.gray.900}" },
          secondary: { value: "{colors.gray.600}" },
          muted: { value: "{colors.gray.500}" },
          inverse: { value: "{colors.gray.50}" },
        },
        border: {
          default: { value: "{colors.gray.200}" },
          focus: { value: "{colors.brand.500}" },
        },
        bg: {
          canvas: { value: "{colors.white}" },
          panel: { value: "{colors.white}" },
          subtle: { value: "{colors.gray.50}" },
        },
      },
    },
  },
})