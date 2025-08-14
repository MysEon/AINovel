"use client"

import React from 'react'
import { ChakraProvider } from "@chakra-ui/react"
import { ThemeProvider } from "next-themes"
import { system } from "./theme"

export function Provider({ children }) {
  return (
    <ChakraProvider value={system}>
      <ThemeProvider 
        attribute="class" 
        defaultTheme="light"
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </ChakraProvider>
  )
}