"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface StoreDetailResponse {
  success: boolean;
  data?: {
    id: string;
    name: string;
    storeNumber: string;
    format: string;
    province: string;
    canton: string;
    location?: {
      latitude?: number | null;
      longitude?: number | null;
      address?: string | null;
      placeId?: string | null;
    };
  };
  message?: string;
}

interface VisitOption {
  id: string;
  title: string;
  description: string;
  status: "activo" | "proximamente";
  href?: (storeId: string) => string;
}

const VISIT_OPTIONS: VisitOption[] = [
  {
    id: "entrada",
    title: "Registro de entrada",
    description:
      "Captura la hora exacta en la que inicia tu visita y agrega notas rápidas.",
    status: "activo",
  },
  {
    id: "salida",
    title: "Registro de salida",
    description:
      "Finaliza tu visita registrando la hora de salida y observaciones clave.",
    status: "activo",
  },
  {
    id: "bitacora",
    title: "Bitácora",
    description:
      "Consulta el historial de respuestas y el puntaje de cumplimiento de la visita.",
    status: "activo",
    href: (storeId: string) => `/userpanel/visitas/${storeId}/bitacora`,
  },
  {
    id: "incidentes",
    title: "Incidentes",
    description:
      "Reporta anomalías, eventos críticos o situaciones especiales ocurridas en tienda.",
    status: "proximamente",
  },
  {
    id: "dinamica",
    title: "Dinámica comercial",
    description:
      "Gestiona actividades promocionales y acciones comerciales (disponible pronto).",
    status: "proximamente",
  },
  {
    id: "recoleccion",
    title: "Recolección de datos",
    description:
      "Completa formularios específicos para la tienda cuando estén habilitados.",
    status: "proximamente",
  },
];

function formatLocation(store: StoreDetailResponse["data"]) {
  if (!store) return "";
  const parts = [store.province, store.canton].filter(Boolean);
  return parts.join(" · ");
}

export default function VisitDetailPage() {
  const params = useParams<{ storeId: string }>();
  const router = useRouter();
  const storeId = params?.storeId ?? "";

  const [store, setStore] = useState<StoreDetailResponse["data"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStore() {
      if (!storeId) {
        setErrorMessage("No se pudo identificar la tienda seleccionada");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);

        const response = await fetch(`/api/stores/${storeId}`);
        const data = (await response.json()) as StoreDetailResponse;

        if (!response.ok || !data.success || !data.data) {
          throw new Error(data.message ?? "No se pudo cargar la tienda");
        }

        setStore(data.data);
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Ocurrió un error al cargar la tienda"
        );
      } finally {
        setIsLoading(false);
      }
    }

    void fetchStore();
  }, [storeId]);

  const locationText = useMemo(
    () => formatLocation(store ?? undefined),
    [store]
  );

  const handleBack = () => {
    router.back();
  };

  return (
    <main className="user-panel-wrapper py-5">
      <div className="container">
        <button
          type="button"
          className="btn btn-outline-light mb-4"
          onClick={handleBack}
        >
          ← Volver
        </button>

        <div className="card shadow-sm border-0 mb-4">
          <div className="card-body p-4 p-lg-5">
            {isLoading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando tienda…</span>
                </div>
              </div>
            ) : errorMessage ? (
              <div className="alert admin-alert alert-danger" role="alert">
                {errorMessage}
              </div>
            ) : store ? (
              <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-4">
                <div>
                  <span className="text-uppercase text-muted small fw-semibold">
                    Visita en curso
                  </span>
                  <h1 className="h3 fw-bold text-white mt-2 mb-2">
                    {store.name}
                  </h1>
                  <p className="mb-2 text-muted">
                    <span aria-hidden className="me-2">
                      📍
                    </span>
                    {locationText || "Ubicación no disponible"}
                  </p>
                  {store.location?.address && (
                    <p className="text-secondary mb-0 small">
                      {store.location.address}
                    </p>
                  )}
                </div>
                <div className="text-lg-end">
                  <p className="text-muted mb-1">Número de tienda</p>
                  <span className="badge admin-badge admin-badge-primary fs-5 px-3 py-2">
                    #{store.storeNumber}
                  </span>
                  <p className="text-muted mt-3 mb-1">Formato</p>
                  <span className="badge admin-badge admin-badge-neutral fw-semibold px-3 py-2">
                    {store.format}
                  </span>
                </div>
              </div>
            ) : (
              <div className="alert admin-alert alert-info" role="alert">
                No se encontró la información de la tienda.
              </div>
            )}
          </div>
        </div>

        <div className="card shadow-sm border-0">
          <div className="card-body p-4 p-lg-5">
            <div className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center justify-content-between gap-3 mb-4">
              <div>
                <h2 className="h4 mb-1">Opciones de la visita</h2>
                <p className="text-muted mb-0">
                  Elige una opción para comenzar a registrar tu trabajo en
                  tienda.
                </p>
              </div>
              <Link
                className="btn btn-outline-light"
                href="/userpanel"
                prefetch={false}
              >
                Ir al panel
              </Link>
            </div>

            <div className="row row-cols-1 row-cols-lg-3 g-4">
              {VISIT_OPTIONS.map((option) => {
                const isActive = option.status === "activo";
                return (
                  <div key={option.id} className="col">
                    <div
                      className={`card h-100 border-0 shadow-sm visit-option-card ${
                        isActive ? "" : "visit-option-card-disabled"
                      }`}
                    >
                      <div className="card-body d-flex flex-column">
                        <h3 className="h5 fw-semibold mb-2">{option.title}</h3>
                        <p className="text-muted small flex-grow-1">
                          {option.description}
                        </p>
                        {isActive && option.href && storeId ? (
                          <Link
                            href={option.href(storeId)}
                            className="btn btn-primary mt-3"
                          >
                            Ingresar
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className={`btn ${
                              isActive ? "btn-primary" : "btn-outline-secondary"
                            } mt-3`}
                            disabled={!isActive}
                          >
                            {isActive ? "Ingresar" : "Próximamente"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
