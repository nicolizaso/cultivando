"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import React from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // Evita que las transiciones de color se disparen al cambiar de tema.
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
