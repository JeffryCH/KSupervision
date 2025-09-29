"use client";

import { useEffect, useState } from "react";
import { useTheme } from "./ThemeProvider";

const LABELS: Record<string, string> = {
  day: "Modo día",
  night: "Modo noche",
};

export default function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isNight = theme === "night";
  const targetLabel = isNight ? LABELS.day : LABELS.night;
  const icon = isNight ? "🌞" : "🌙";

  return (
    <button
      type="button"
      className="btn btn-sm theme-toggle-button"
      onClick={toggleTheme}
      aria-label={`Cambiar a ${targetLabel.toLowerCase()}`}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {mounted ? icon : "🌗"}
      </span>
      <span className="theme-toggle-label">
        {mounted ? targetLabel : "Tema"}
      </span>
    </button>
  );
}
