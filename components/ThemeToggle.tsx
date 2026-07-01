"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Asegurar que solo se renderice en el cliente para evitar mismatch de hidratación
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-8 h-8" />; // Placeholder del mismo tamaño
  }

  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = currentTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="p-2 rounded-full transition-colors hover:bg-black/5 dark:hover:bg-card-border text-muted dark:text-muted hover:text-brand-primary dark:hover:text-white focus:outline-none"
      aria-label="Toggle Dark Mode"
    >
      {isDark ? (
        <Sun size={20} className="animate-in spin-in-90 duration-300" />
      ) : (
        <Moon size={20} className="animate-in spin-in-[-90] duration-300" />
      )}
    </button>
  );
}
