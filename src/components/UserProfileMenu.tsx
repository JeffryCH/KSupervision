"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserSession } from "@/hooks/useUserSession";
import ThemeToggleButton from "./ThemeToggleButton";

function formatRole(role: string) {
  const normalized = role.toLowerCase();
  if (normalized === "admin") return "Administrador";
  if (normalized === "supervisor") return "Supervisor";
  if (normalized === "usuario") return "Usuario";
  return role;
}

export default function UserProfileMenu() {
  const router = useRouter();
  const { user, logout } = useUserSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popoverId = useId();

  const roleLabel = useMemo(() => {
    if (!user) return "";
    return formatRole(user.role ?? "");
  }, [user]);

  const userInitial = useMemo(() => {
    const raw = user?.nombre ?? "";
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return "?";
    }
    return trimmed.charAt(0).toUpperCase();
  }, [user?.nombre]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    router.push("/login");
  };

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const toggleMenu = () => {
    setMenuOpen((prev) => !prev);
  };

  if (!user) {
    return null;
  }

  return (
    <aside
      className={`user-profile-bar${menuOpen ? " is-open" : ""}`}
      aria-label="Menú de usuario"
      ref={containerRef}
    >
      <div className="user-profile-content">
        <div className="user-profile-meta">
          <span className="user-profile-name">{user.nombre}</span>
          <span className="user-profile-role">{roleLabel}</span>
        </div>
        <div className="user-profile-actions">
          <ThemeToggleButton />
          <button
            type="button"
            className="btn btn-outline-light btn-sm user-profile-logout"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
      <button
        type="button"
        className="user-profile-trigger"
        aria-label={`Abrir menú de ${user.nombre}`}
        aria-haspopup="true"
        aria-expanded={menuOpen}
        aria-controls={popoverId}
        onClick={toggleMenu}
      >
        <span aria-hidden="true">{userInitial}</span>
      </button>
      <div
        className="user-profile-popover"
        role="dialog"
        aria-modal="false"
        aria-label="Acciones de usuario"
        aria-hidden={!menuOpen}
        data-open={menuOpen ? "true" : "false"}
        id={popoverId}
      >
        <div className="user-profile-popover-header">
          <span className="user-profile-popover-name">{user.nombre}</span>
          <span className="user-profile-popover-role">{roleLabel}</span>
        </div>
        <div className="user-profile-popover-actions">
          <ThemeToggleButton />
          <button
            type="button"
            className="btn btn-outline-light btn-sm user-profile-logout"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  );
}
