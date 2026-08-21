"use client";

import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "@/components/icons";
import { applyTheme, getStoredTheme, toggleTheme, type ThemeMode } from "@/lib/theme";

type Props = {
  /** Sidebar footer style matching the home mock */
  variant?: "default" | "sidebar";
};

function initialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  return getStoredTheme();
}

export function ThemeToggle({ variant = "default" }: Props) {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);

  useEffect(() => {
    const current = getStoredTheme();
    applyTheme(current);
    setTheme(current);
  }, []);

  function onClick() {
    setTheme(toggleTheme());
  }

  const ariaLabel = theme === "light" ? "切换到深色模式" : "切换到浅色模式";

  if (variant === "sidebar") {
    const isLight = theme === "light";
    return (
      <button type="button" className="mn-theme-toggle" aria-label={ariaLabel} onClick={onClick}>
        {isLight ? <IconMoon size={18} /> : <IconSun size={18} />}
        <span>{isLight ? "深色模式" : "浅色模式"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-ghost theme-toggle-header"
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {theme === "light" ? <IconMoon size={18} /> : <IconSun size={18} />}
      <span className="theme-toggle-label">{theme === "dark" ? "浅色" : "深色"}</span>
    </button>
  );
}
