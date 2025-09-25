import Link from "next/link";

export default function Home() {
  return (
    <>
      <a href="#contenido-principal" className="skip-nav-link">
        Saltar al contenido principal
      </a>
      <header>
        <nav
          className="navbar navbar-expand-lg navbar-dark custom-navbar"
          aria-label="Navegación principal"
          role="navigation"
        >
          <div className="container">
            <Link href="/" className="navbar-brand fw-bold text-uppercase">
              Advertising & Promotion
            </Link>
            <button
              className="navbar-toggler"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#navbarSupportedContent"
              aria-controls="navbarSupportedContent"
              aria-expanded="false"
              aria-label="Alternar navegación"
            >
              <span className="navbar-toggler-icon" />
            </button>
            <div
              className="collapse navbar-collapse"
              id="navbarSupportedContent"
            >
              <ul
                className="navbar-nav ms-auto mb-2 mb-lg-0"
                aria-label="Secciones del sitio"
              >
                <li className="nav-item">
                  <Link href="#servicios" className="nav-link">
                    Servicios
                  </Link>
                </li>
                <li className="nav-item">
                  <Link href="#clientes" className="nav-link">
                    Clientes
                  </Link>
                </li>
                <li className="nav-item">
                  <Link href="#contacto" className="nav-link">
                    Contacto
                  </Link>
                </li>
              </ul>
              <Link
                href="/login"
                className="btn btn-outline-light ms-lg-3"
                aria-label="Ir a la página de inicio de sesión"
              >
                Iniciar sesión
              </Link>
            </div>
          </div>
        </nav>
      </header>

      <main id="contenido-principal" className="main-content" tabIndex={-1}>
        <section id="inicio" className="hero-section">
          <div className="container">
            <div className="row align-items-center g-5">
              <div className="col-lg-7">
                <span className="hero-badge">
                  <i className="fas fa-bolt me-2" aria-hidden="true" />
                  Estrategias para marcas modernas
                </span>
                <h1 className="hero-title mb-3">
                  Impulsamos experiencias que conectan con nuevas audiencias
                </h1>
                <p className="hero-subtitle mb-4">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis
                  viverra, velit eget varius luctus, enim lorem vehicula mauris,
                  vitae laoreet felis velit non risus.
                </p>
                <div className="d-flex flex-wrap gap-3">
                  <Link
                    href="/login"
                    className="btn btn-primary btn-lg"
                    aria-label="Acceder al panel de supervisión"
                  >
                    Iniciar sesión
                  </Link>
                  <Link
                    href="#servicios"
                    className="btn btn-outline-primary btn-lg"
                    aria-label="Ir a la sección de servicios"
                  >
                    Conoce más
                  </Link>
                </div>
              </div>
              <div className="col-lg-5">
                <div className="hero-card p-4 p-lg-5">
                  <h2 className="h4 mb-3">¿Qué hacemos?</h2>
                  <p className="mb-0">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                    Praesent vehicula ex quis est gravida, id aliquam magna
                    vestibulum. Fusce in magna vel orci consequat varius sed
                    vitae nibh.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="servicios" className="section-padding bg-surface">
          <div className="container">
            <div className="section-heading">
              <span>Servicios</span>
              <h2 className="fw-bold text-white mb-3">Nuestros servicios</h2>
              <p className="text-muted">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla
                facilisi.
              </p>
              <div className="gradient-divider" />
            </div>
            <div className="row g-4">
              {[
                "Planeación de campañas",
                "Estrategia digital",
                "Producción creativa",
              ].map((service) => (
                <div className="col-md-4" key={service}>
                  <div className="feature-card h-100 p-4">
                    <h3 className="h5 mb-3">{service}</h3>
                    <p>
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                      Sed sit amet augue dapibus, faucibus velit quis, facilisis
                      libero.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="clientes" className="section-padding">
          <div className="container">
            <div className="section-heading">
              <span>Clientes</span>
              <h2 className="fw-bold text-white mb-3">Confían en nosotros</h2>
              <p className="text-muted">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer
                fermentum nisl eget.
              </p>
              <div className="gradient-divider" />
            </div>
            <div className="row row-cols-1 row-cols-md-3 g-4">
              {["Kellanova", "Cliente 2", "Cliente 3"].map((client) => (
                <div className="col" key={client}>
                  <div className="client-card h-100 p-4 text-center">
                    <h3 className="h5 mb-2">{client}</h3>
                    <p>
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                      Pellentesque non dolor vitae augue sollicitudin convallis.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="contacto" className="section-padding bg-surface-alt">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-8">
                <div className="contact-section text-center">
                  <h2 className="fw-bold mb-3">¿Listo para empezar?</h2>
                  <p className="text-muted mb-4">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                    Phasellus ut urna id dolor sagittis aliquet. Vestibulum
                    volutpat, mi sit amet vestibulum dictum, velit ante iaculis
                    justo, non consequat nibh turpis eu sem.
                  </p>
                  <Link href="/login" className="btn btn-primary btn-lg">
                    Iniciar sesión
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-4 bg-dark text-white">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-md-6 text-center text-md-start mb-3 mb-md-0">
              <p className="mb-0">
                &copy; {new Date().getFullYear()} Advertising & Promotion S.A.
                Todos los derechos reservados.
              </p>
            </div>
            <div className="col-md-6 text-center text-md-end">
              <Link
                href="#servicios"
                className="text-white text-decoration-none me-3"
              >
                Servicios
              </Link>
              <Link
                href="#clientes"
                className="text-white text-decoration-none me-3"
              >
                Clientes
              </Link>
              <Link
                href="#contacto"
                className="text-white text-decoration-none"
              >
                Contacto
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
