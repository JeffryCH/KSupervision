import Link from "next/link";

export default function AdminOverviewPage() {
  return (
    <main className="admin-dashboard-wrapper">
      <div className="container">
        <section className="admin-dashboard-hero mb-5">
          <div className="d-inline-flex align-items-center gap-2 mb-3 px-3 py-2 rounded-pill bg-gradient">
            <span className="auth-badge mb-0">Administración</span>
          </div>
          <h1 className="display-5 fw-bold mb-3">Centro de control</h1>
          <p className="lead text-muted mb-4">
            Bienvenido al espacio centralizado para administrar la plataforma.
            Desde aquí puedes acceder al panel de módulos, gestionar usuarios y
            revisar configuraciones clave.
          </p>
          <div className="d-flex flex-wrap gap-3">
            <Link href="/admin/panel" className="btn btn-primary btn-lg">
              Ir al panel de módulos
            </Link>
            <Link
              href="/admin/users"
              className="btn btn-outline-primary btn-lg"
            >
              Gestionar usuarios
            </Link>
          </div>
        </section>

        <section className="row g-4" aria-label="Información general">
          <div className="col-md-6">
            <div className="admin-module-card h-100">
              <div className="module-icon" aria-hidden="true">
                <i className="fas fa-bullseye" />
              </div>
              <h2 className="h5 fw-semibold mb-3">Objetivos principales</h2>
              <p className="mb-0">
                Mantén la visibilidad de los proyectos activos y coordina los
                distintos equipos desde un único lugar. El panel de módulos te
                permitirá activar nuevas capacidades tan pronto estén
                disponibles.
              </p>
            </div>
          </div>
          <div className="col-md-6">
            <div className="admin-module-card h-100">
              <div className="module-icon" aria-hidden="true">
                <i className="fas fa-shield-alt" />
              </div>
              <h2 className="h5 fw-semibold mb-3">Próximos pasos</h2>
              <p className="mb-3">
                El equipo está trabajando en reportes avanzados y supervisión en
                tiempo real. Encontrarás notificaciones dentro del panel cuando
                cada módulo esté listo.
              </p>
              <Link
                href="/admin/panel"
                className="btn btn-outline-primary w-auto"
                aria-label="Ver módulo de novedades"
              >
                Revisar módulos
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
