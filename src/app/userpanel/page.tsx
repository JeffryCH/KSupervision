"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { SessionUser } from "@/lib/session";
import { useUserSession } from "@/hooks/useUserSession";

interface StoreSummary {
  id: string;
  name: string;
  storeNumber: string;
  format: string;
  province: string;
  canton: string;
  address?: string | null;
  location?: {
    latitude: number | null;
    longitude: number | null;
  } | null;
}

interface StoresResponse {
  success: boolean;
  data: StoreSummary[];
  message?: string;
}

type PlatformType = "ios" | "android" | "desktop";

function detectPlatform(): PlatformType {
  if (typeof window === "undefined") {
    return "desktop";
  }

  const userAgent = window.navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(userAgent)) {
    return "ios";
  }
  if (/Android/i.test(userAgent)) {
    return "android";
  }
  return "desktop";
}

function hasCoordinates(store: StoreSummary) {
  const lat = store.location?.latitude;
  const lon = store.location?.longitude;
  return typeof lat === "number" && typeof lon === "number";
}

function buildWazeUrl(store: StoreSummary) {
  if (!hasCoordinates(store)) return null;
  const lat = store.location!.latitude;
  const lon = store.location!.longitude;
  return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes&zoom=17`;
}

function buildMapsUrl(store: StoreSummary, platform: PlatformType) {
  if (!hasCoordinates(store)) return null;
  const lat = store.location!.latitude;
  const lon = store.location!.longitude;

  if (platform === "ios") {
    return `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
  }

  if (platform === "android") {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

function formatLocation(store: StoreSummary) {
  const parts = [store.province, store.canton].filter(Boolean);
  return parts.join(" · ");
}

function buildGreeting(user: SessionUser | null) {
  if (!user) return "Bienvenido";
  const firstName = user.nombre?.split(" ")[0] ?? user.nombre;
  return `Hola, ${firstName}`;
}

export default function UserPanelPage() {
  const router = useRouter();
  const { user } = useUserSession();
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(true);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<PlatformType>("desktop");

  const greeting = useMemo(() => buildGreeting(user), [user]);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  useEffect(() => {
    async function fetchStores() {
      try {
        setIsLoadingStores(true);
        setStoresError(null);

        const response = await fetch("/api/stores");
        const data = (await response.json()) as StoresResponse;

        if (!response.ok || !data.success) {
          throw new Error(data.message ?? "No se pudieron obtener las tiendas");
        }

        setStores(data.data ?? []);
      } catch (error) {
        console.error(error);
        setStoresError(
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado al cargar las tiendas"
        );
      } finally {
        setIsLoadingStores(false);
      }
    }

    void fetchStores();
  }, []);

  const handleVisit = (storeId: string) => {
    router.push(`/userpanel/visitas/${storeId}`);
  };

  const renderStoreCards = () => {
    if (isLoadingStores) {
      return (
        <div className="text-center py-4" aria-live="polite">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando tiendas…</span>
          </div>
        </div>
      );
    }

    if (storesError) {
      return (
        <div className="alert admin-alert alert-danger" role="alert">
          {storesError}
        </div>
      );
    }

    if (stores.length === 0) {
      return (
        <div className="alert admin-alert alert-info" role="status">
          Aún no tienes tiendas asignadas. Vuelve a intentarlo más tarde.
        </div>
      );
    }

    return (
      <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4">
        {stores.map((store) => {
          const wazeUrl = buildWazeUrl(store);
          const mapsUrl = buildMapsUrl(store, platform);

          return (
            <div key={store.id} className="col">
              <div className="card h-100 shadow-sm border-0 user-store-card">
                <div className="card-body d-flex flex-column">
                  <div className="d-flex align-items-start justify-content-between mb-3 gap-3">
                    <div>
                      <h3 className="h5 mb-1">{store.name}</h3>
                      <span className="badge admin-badge admin-badge-primary">
                        #{store.storeNumber || "SN"}
                      </span>
                    </div>
                    <span className="badge admin-badge admin-badge-neutral rounded-pill fw-semibold">
                      {store.format}
                    </span>
                  </div>

                  <p className="text-muted small mb-2">
                    <span aria-hidden className="me-1">
                      📍
                    </span>
                    {formatLocation(store) || "Ubicación no disponible"}
                  </p>

                  {store.address && (
                    <p className="mb-3 small text-secondary">{store.address}</p>
                  )}

                  <div className="mt-auto d-flex flex-column gap-2">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleVisit(store.id)}
                    >
                      Programar visita
                    </button>
                    <div className="d-flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm flex-grow-1"
                        onClick={() =>
                          wazeUrl && window.open(wazeUrl, "_blank")
                        }
                        disabled={!wazeUrl}
                        aria-label={`Abrir ${store.name} en Waze`}
                      >
                        Abrir en Waze
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm flex-grow-1"
                        onClick={() =>
                          mapsUrl && window.open(mapsUrl, "_blank")
                        }
                        disabled={!mapsUrl}
                        aria-label={`Abrir ${store.name} en Maps`}
                      >
                        Abrir en Maps
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <main className="user-panel-wrapper py-5">
      <div className="container">
        <header className="mb-5">
          <span className="text-uppercase text-muted small fw-semibold">
            Panel del usuario
          </span>
          <h1 className="display-6 fw-bold text-white mt-2 mb-3">{greeting}</h1>
          <p className="text-muted lead mb-0">
            Accede rápidamente a tus visitas, registra tus avances y consulta la
            información de las tiendas asignadas.
          </p>
        </header>

        <section className="mb-5">
          <div className="card shadow-sm border-0">
            <div className="card-body p-4 p-lg-5">
              <div className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center justify-content-between gap-3 mb-4">
                <div>
                  <h2 className="h4 mb-1">Visitas disponibles</h2>
                  <p className="text-muted mb-0">
                    Selecciona una tienda para iniciar tu visita y registrar lo
                    realizado en campo.
                  </p>
                </div>
                <Link
                  className="btn btn-outline-light"
                  href="/admin/panel"
                  prefetch={false}
                >
                  ¿Necesitas el panel completo?
                </Link>
              </div>
              {renderStoreCards()}
            </div>
          </div>
        </section>

        <section className="mb-5">
          <div className="card shadow-sm border-0">
            <div className="card-body p-4 p-lg-5">
              <div className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center justify-content-between gap-3 mb-4">
                <div>
                  <h2 className="h4 mb-1">Registro de visitas</h2>
                  <p className="text-muted mb-0">
                    Aquí aparecerán tus registros recientes. Muy pronto podrás
                    ver el historial completo.
                  </p>
                </div>
              </div>
              <div className="text-center py-5 text-muted">
                <span className="display-5 d-block mb-3" aria-hidden>
                  🗒️
                </span>
                <p className="mb-2">Aún no se han registrado visitas.</p>
                <p className="small">
                  Comienza programando una visita desde el listado anterior para
                  activar tu bitácora.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="card shadow-sm border-0">
            <div className="card-body p-4 p-lg-5">
              <div className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center justify-content-between gap-3 mb-4">
                <div>
                  <h2 className="h4 mb-1">Información de tiendas</h2>
                  <p className="text-muted mb-0">
                    Consulta los datos clave de cada tienda. Esta información es
                    de solo lectura.
                  </p>
                </div>
              </div>
              {isLoadingStores ? (
                <div className="text-center py-4" aria-live="polite">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Cargando tiendas…</span>
                  </div>
                </div>
              ) : stores.length === 0 ? (
                <div className="alert admin-alert alert-info" role="status">
                  No hay tiendas disponibles para mostrar.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-dark table-hover align-middle mb-0">
                    <thead>
                      <tr>
                        <th scope="col">Nombre</th>
                        <th scope="col">Formato</th>
                        <th scope="col">Ubicación</th>
                        <th scope="col">Dirección</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stores.map((store) => (
                        <tr key={`info-${store.id}`}>
                          <td className="fw-semibold">{store.name}</td>
                          <td>{store.format}</td>
                          <td>{formatLocation(store) || "-"}</td>
                          <td>{store.address || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
