"use client";

import Link from "next/link";
import AdminGuard from "@/components/admin/AdminGuard";

const adminModules = [
  {
    title: "Gestión de usuarios",
    description:
      "Administra cuentas, roles y accesos del personal autorizado de la plataforma.",
    href: "/admin/users",
    icon: "fas fa-users",
    status: "available" as const,
    badge: "Disponible",
  },
  {
    title: "Gestión de tiendas",
    description:
      "Registra, localiza y asigna responsables a las tiendas con integración de Google Places.",
    href: "/admin/stores",
    icon: "fas fa-store",
    status: "available" as const,
    badge: "Disponible",
  },
  {
    title: "Gestión de productos",
    description:
      "Administra el catálogo, asigna códigos UPC y captura códigos de barras mediante cámara.",
    href: "/admin/products",
    icon: "fas fa-box-open",
    status: "available" as const,
    badge: "Disponible",
  },
  {
    title: "Gestión de rutas",
    description:
      "Planifica recorridos, asigna supervisores y colaboradores y visualiza la ruta en el mapa.",
    href: "/admin/routes",
    icon: "fas fa-route",
    status: "available" as const,
    badge: "Disponible",
  },
  {
    title: "Gestión de formularios",
    description:
      "Diseña, publica y administra los formularios de visita y sus reglas de cumplimiento.",
    href: "/admin/forms",
    icon: "fas fa-file-alt",
    status: "available" as const,
    badge: "Disponible",
  },
  {
    title: "Grupos de trabajo",
    description:
      "Relaciona supervisores con sus equipos y administra la asignación de colaboradores.",
    href: "/admin/workgroups",
    icon: "fas fa-people-arrows",
    status: "available" as const,
    badge: "Nuevo",
  },
  {
    title: "Asignación de rutas",
    description:
      "Distribuye las rutas disponibles entre los colaboradores de cada supervisor.",
    href: "/admin/route-assignments",
    icon: "fas fa-map-marker-alt",
    status: "available" as const,
    badge: "Nuevo",
  },
  {
    title: "Bitácoras de visitas",
    description:
      "Consulta el historial de formularios completados, puntajes de cumplimiento y cambios por visita.",
    href: "/admin/visit-logs",
    icon: "fas fa-clipboard-check",
    status: "available" as const,
    badge: "Nuevo",
  },
  {
    title: "Reportes y analíticas",
    description:
      "Visualiza métricas, reportes operativos e indicadores clave de desempeño.",
    href: "#",
    icon: "fas fa-chart-line",
    status: "soon" as const,
    badge: "Próximamente",
  },
  {
    title: "Supervisión en tiempo real",
    description:
      "Monitorea la actividad de campo y recibe alertas en tiempo real.",
    href: "#",
    icon: "fas fa-eye",
    status: "soon" as const,
    badge: "En desarrollo",
  },
  {
    title: "Configuraciones avanzadas",
    description:
      "Personaliza reglas del sistema, notificaciones y parámetros de seguridad.",
    href: "#",
    icon: "fas fa-sliders-h",
    status: "planning" as const,
    badge: "Planificado",
  },
];

export default function AdminPanelPage() {
  return (
    <AdminGuard>
      <main className="admin-dashboard-wrapper">
        <div className="container">
          <section className="admin-dashboard-hero mb-5">
            <div className="d-inline-flex align-items-center gap-2 mb-3 px-3 py-2 rounded-pill bg-gradient">
              <span className="auth-badge mb-0">Panel del administrador</span>
            </div>
            <h1 className="display-5 fw-bold mb-3">Módulos disponibles</h1>
            <p className="lead text-muted mb-0">
              Accede a las herramientas de supervisión, configuración y análisis
              de la plataforma. Los módulos nuevos aparecerán aquí
              automáticamente.
            </p>
          </section>

          <section aria-label="Módulos administrativos">
            <div className="admin-modules-grid">
              {adminModules.map((module) => {
                const isAvailable = module.status === "available";

                return (
                  <article
                    key={module.title}
                    className={`admin-module-card ${
                      isAvailable ? "" : "disabled"
                    }`}
                  >
                    <div className="module-icon" aria-hidden="true">
                      <i className={module.icon} />
                    </div>
                    <span className="badge rounded-pill mb-2">
                      {module.badge}
                    </span>
                    <h2 className="h4 fw-semibold mb-3">{module.title}</h2>
                    <p>{module.description}</p>

                    {isAvailable ? (
                      <Link
                        href={module.href}
                        className="btn btn-outline-primary w-auto"
                        aria-label={`Abrir módulo ${module.title}`}
                      >
                        Abrir módulo
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline-primary w-auto"
                        disabled
                      >
                        Muy pronto
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </AdminGuard>
  );
}
