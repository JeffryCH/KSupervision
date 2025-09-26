"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearSessionUser,
  loadSessionUser,
  saveSessionUser,
  SESSION_EVENT,
  SESSION_STORAGE_KEY,
  type SessionUser,
} from "@/lib/session";

interface UseUserSessionResult {
  user: SessionUser | null;
  isLoading: boolean;
  setSession: (user: SessionUser | null) => void;
  logout: () => void;
}

export function useUserSession(): UseUserSessionResult {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUser(loadSessionUser());
    setIsLoading(false);

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== SESSION_STORAGE_KEY) {
        return;
      }

      setUser(loadSessionUser());
    };

    const handleSessionEvent = () => {
      setUser(loadSessionUser());
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(SESSION_EVENT, handleSessionEvent);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(SESSION_EVENT, handleSessionEvent);
    };
  }, []);

  const setSession = useCallback((value: SessionUser | null) => {
    if (value) {
      saveSessionUser(value);
      setUser(value);
    } else {
      clearSessionUser();
      setUser(null);
    }
  }, []);

  const logout = useCallback(() => {
    clearSessionUser();
    setUser(null);
  }, []);

  return { user, isLoading, setSession, logout };
}
