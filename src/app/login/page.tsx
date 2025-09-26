"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { saveSessionUser } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const cedula = (formData.get("cedula") as string | null)?.trim() ?? "";
    const password = (formData.get("password") as string | null)?.trim() ?? "";

    if (!cedula || !password) {
      setErrorMessage("Por favor ingresa cédula y contraseña válidas.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cedula, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Credenciales inválidas");
      }

      const userRole = data.user?.role;

      if (userRole !== "admin") {
        setErrorMessage(
          "Tu cuenta no tiene permisos para acceder al panel de administración."
        );
        return;
      }

      saveSessionUser({
        id: data.user.id,
        nombre: data.user.nombre,
        role: data.user.role,
      });

      setSuccessMessage(
        "Bienvenido. Redirigiendo al panel de administración..."
      );
      form.reset();
      router.push("/admin/panel");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo completar el inicio de sesión";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-wrapper">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-5 col-md-8">
            <div className="auth-card p-4 p-lg-5">
              <div className="text-center mb-4">
                <span className="auth-badge">Acceso seguro</span>
                <h1 className="h3 fw-bold mt-3 mb-2">Iniciar sesión</h1>
                <p className="text-muted">
                  Ingresa tus credenciales para acceder al panel de supervisión.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                {errorMessage && (
                  <div
                    className="alert alert-danger"
                    role="alert"
                    aria-live="assertive"
                  >
                    {errorMessage}
                  </div>
                )}
                {successMessage && (
                  <div
                    className="alert alert-success"
                    role="alert"
                    aria-live="polite"
                  >
                    {successMessage}
                  </div>
                )}

                <div className="mb-4">
                  <label htmlFor="cedula" className="form-label">
                    Cédula
                  </label>
                  <input
                    type="text"
                    id="cedula"
                    name="cedula"
                    className="form-control form-control-lg"
                    inputMode="numeric"
                    pattern="\\d{6,12}"
                    placeholder="Ingresa tu número de cédula"
                    aria-describedby="cedulaHelp"
                    required
                  />
                  <div id="cedulaHelp" className="form-text">
                    Utiliza solo números, sin guiones ni espacios.
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="password" className="form-label">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    className="form-control form-control-lg"
                    placeholder="Ingresa tu contraseña"
                    required
                    minLength={6}
                  />
                </div>

                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="rememberMe"
                      name="rememberMe"
                    />
                    <label className="form-check-label" htmlFor="rememberMe">
                      Recordarme
                    </label>
                  </div>
                  <Link href="#" className="auth-link">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100 mb-3"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Ingresando..." : "Ingresar"}
                </button>
              </form>

              <p className="auth-footer text-muted mb-0 text-center">
                ¿Necesitas ayuda? Comunícate con el administrador o{" "}
                <Link href="#contacto" className="auth-link">
                  vuelve a la página principal
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
