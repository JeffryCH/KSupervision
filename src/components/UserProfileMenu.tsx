"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUserSession } from "@/hooks/useUserSession";

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

  const roleLabel = useMemo(() => {
    if (!user) return "";
    return formatRole(user.role ?? "");
  }, [user]);

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <aside className="user-profile-bar" aria-label="Menú de usuario">
      <div className="user-profile-meta">
        <span className="user-profile-name">{user.nombre}</span>
        <span className="user-profile-role">{roleLabel}</span>
      </div>
      <button
        type="button"
        className="btn btn-outline-light btn-sm user-profile-logout"
        onClick={handleLogout}
      >
        Cerrar sesión
      </button>
    </aside>
  );
}
