"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "app-theme";

export type ThemeMode = "day" | "night";

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (value: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.setAttribute("data-theme", theme);
}

function readStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") {
    return null;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "day" || stored === "night") {
    return stored;
  }
  return null;
}

function getPreferredTheme(): ThemeMode {
  if (typeof window !== "undefined" && window.matchMedia) {
    const prefersLight = window.matchMedia(
      "(prefers-color-scheme: light)"
    ).matches;
    if (prefersLight) {
      return "day";
    }
  }
  return "night";
}

function readAttributeTheme(): ThemeMode | null {
  if (typeof document === "undefined") {
    return null;
  }
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "day" || attr === "night") {
    return attr;
  }
  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [manualPreference, setManualPreference] = useState<ThemeMode | null>(
    () => readStoredTheme()
  );
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const stored = readStoredTheme();
    if (stored) {
      return stored;
    }
    const attributeTheme = readAttributeTheme();
    if (attributeTheme) {
      return attributeTheme;
    }
    return getPreferredTheme();
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (manualPreference) {
      window.localStorage.setItem(STORAGE_KEY, manualPreference);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [manualPreference]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");

    const applySystemPreference = (matches: boolean) => {
      if (manualPreference !== null) {
        return;
      }
      const nextTheme: ThemeMode = matches ? "day" : "night";
      setThemeState((current) => (current === nextTheme ? current : nextTheme));
    };

    applySystemPreference(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      applySystemPreference(event.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", listener);
      return () => {
        mediaQuery.removeEventListener("change", listener);
      };
    }

    mediaQuery.addListener(listener);
    return () => {
      mediaQuery.removeListener(listener);
    };
  }, [manualPreference]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncFromStorage = () => {
      const stored = readStoredTheme();
      if (stored) {
        if (stored !== manualPreference) {
          setManualPreference(stored);
          setThemeState(stored);
        }
        return;
      }

      if (manualPreference !== null) {
        setManualPreference(null);
        setThemeState(getPreferredTheme());
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }
      if (event.newValue === "day" || event.newValue === "night") {
        if (event.newValue !== manualPreference) {
          setManualPreference(event.newValue);
          setThemeState(event.newValue);
        }
        return;
      }

      if (manualPreference !== null) {
        setManualPreference(null);
        setThemeState(getPreferredTheme());
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", syncFromStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", syncFromStorage);
    };
  }, [manualPreference]);

  const applyManualTheme = useCallback((value: ThemeMode) => {
    setManualPreference(value);
    setThemeState(value);
  }, []);

  const setTheme = useCallback(
    (value: ThemeMode) => {
      applyManualTheme(value);
    },
    [applyManualTheme]
  );

  const toggleTheme = useCallback(() => {
    applyManualTheme(theme === "night" ? "day" : "night");
  }, [applyManualTheme, theme]);

  const value = useMemo(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme debe ser utilizado dentro de ThemeProvider");
  }
  return context;
}
