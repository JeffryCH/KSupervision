"use client";

import { PropsWithChildren, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUserSession } from "@/hooks/useUserSession";

export default function AdminGuard({ children }: PropsWithChildren) {
  const router = useRouter();
  const { user, isLoading } = useUserSession();

  const isAdmin = useMemo(() => {
    if (!user) return false;
    return user.role?.toLowerCase() === "admin";
  }, [user]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAdmin) {
      router.replace("/login");
    }
  }, [isAdmin, isLoading, router]);

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

  if (!isAdmin) {
    return null;
  }

  return <>{children}</>;
}
