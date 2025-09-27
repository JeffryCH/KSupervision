"use client";

import { PropsWithChildren, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUserSession } from "@/hooks/useUserSession";

export default function UserGuard({ children }: PropsWithChildren) {
  const router = useRouter();
  const { user, isLoading } = useUserSession();

  const isUserRole = useMemo(() => {
    if (!user) return false;
    const role = user.role?.toLowerCase();
    return role === "usuario";
  }, [user]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isUserRole) {
      router.replace("/login");
    }
  }, [isLoading, isUserRole, router]);

  if (isLoading) {
    return (
      <div className="admin-guard-placeholder">
        <div
          className="spinner-border text-primary"
          role="status"
          aria-live="polite"
        >
          <span className="visually-hidden">Verificando credenciales…</span>
        </div>
      </div>
    );
  }

  if (!isUserRole) {
    return null;
  }

  return <>{children}</>;
}
