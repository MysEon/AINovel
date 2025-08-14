"use client"

import React from 'react'
import { useTheme } from "next-themes"
import { LuSun, LuMoon } from "react-icons/lu"

export function ColorModeButton() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light")
  }

  return (
    <button
      onClick={toggleTheme}
      style={{
        position: "fixed",
        top: "1rem",
        right: "1rem",
        zIndex: 9999,
        padding: "0.5rem",
        borderRadius: "0.5rem",
        backgroundColor: "var(--chakra-colors-gray-200)",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "2.5rem",
        height: "2.5rem",
      }}
      title={theme === "light" ? "切换到暗色模式" : "切换到亮色模式"}
    >
      {theme === "light" ? (
        <LuMoon style={{ width: "1.25rem", height: "1.25rem", color: "var(--chakra-colors-gray-700)" }} />
      ) : (
        <LuSun style={{ width: "1.25rem", height: "1.25rem", color: "var(--chakra-colors-yellow-400)" }} />
      )}
    </button>
  )
}