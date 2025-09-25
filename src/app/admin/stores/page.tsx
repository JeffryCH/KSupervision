"use client";

import dynamic from "next/dynamic";
import {
  FormEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const StoreLocationMap = dynamic(
  () => import("@/components/admin/StoreLocationMap"),
  { ssr: false }
);

type StoreFormat = "Walmart" | "Mas x Menos" | "Pali" | "Maxi Pali";

type Store = {
  id: string;
  name: string;
  storeNumber: string;
  format: StoreFormat;
  province: string;
  canton: string;
  supervisors: string[];
  location: {
    latitude: number | null;
    longitude: number | null;
    address?: string;
    placeId?: string;
  };
  createdAt: string;
  updatedAt: string;
};

type StatusMessage = {
  type: "success" | "error";
  text: string;
};

type SupervisorOption = {
  id: string;
  nombre: string;
  email: string;
  role: "admin" | "supervisor" | "usuario";
};

type PlaceSuggestion = {
  id: string;
  name: string;
  address: string;
  location: {
    latitude: number | null;
    longitude: number | null;
  };
  rating: number | null;
  types: string[];
};

type PlaceDetails = {
  id: string;
  name: string;
  address: string;
  province?: string;
  canton?: string;
  location?: {
    latitude: number | null;
    longitude: number | null;
  };
};

interface StoreFormState {
  name: string;
  storeNumber: string;
  format: StoreFormat;
  province: string;
  canton: string;
  supervisors: string[];
  latitude: string;
  longitude: string;
  address: string;
  placeId: string;
}

const STORE_FORMATS: StoreFormat[] = [
  "Walmart",
  "Mas x Menos",
  "Pali",
  "Maxi Pali",
];

const COSTA_RICA_PROVINCES = [
  "San José",
  "Alajuela",
  "Cartago",
  "Heredia",
  "Guanacaste",
  "Puntarenas",
  "Limón",
];

const emptyFormState: StoreFormState = {
  name: "",
  storeNumber: "",
  format: "Walmart",
  province: "",
  canton: "",
  supervisors: [],
  latitude: "",
  longitude: "",
  address: "",
  placeId: "",
};

export default function AdminStoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState<StoreFormat | "">("");
  const [provinceFilter, setProvinceFilter] = useState("");
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null
  );
  const [showFormModal, setShowFormModal] = useState(false);
  const [formState, setFormState] = useState<StoreFormState>(emptyFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [supervisors, setSupervisors] = useState<SupervisorOption[]>([]);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceSuggestion[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [loadingPlaceDetails, setLoadingPlaceDetails] = useState(false);

  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const hasStores = stores.length > 0;

  const supervisorMap = useMemo(() => {
    return supervisors.reduce<Map<string, SupervisorOption>>((map, user) => {
      map.set(user.id, user);
      return map;
    }, new Map());
  }, [supervisors]);

  const fetchStores = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (formatFilter) params.set("format", formatFilter);
      if (provinceFilter) params.set("province", provinceFilter);

      const query = params.toString();
      const response = await fetch(
        query ? `/api/stores?${query}` : "/api/stores"
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "No se pudieron obtener las tiendas");
      }

      setStores(data.data ?? []);
    } catch (error) {
      console.error(error);
      setStatusMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al cargar las tiendas",
      });
    } finally {
      setLoading(false);
    }
  }, [search, formatFilter, provinceFilter]);

  const fetchSupervisors = useCallback(async () => {
    try {
      const response = await fetch("/api/users");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "No se pudieron obtener los usuarios");
      }

      const eligible: SupervisorOption[] = (data.data ?? []).filter(
        (user: SupervisorOption) =>
          user.role === "admin" || user.role === "supervisor"
      );

      setSupervisors(eligible);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    void fetchStores();
  }, [fetchStores]);

  useEffect(() => {
    void fetchSupervisors();
  }, [fetchSupervisors]);

  const resetFormState = useCallback(() => {
    setFormState(emptyFormState);
    setPlaceQuery("");
    setPlaceResults([]);
    setLoadingPlaceDetails(false);
  }, []);

  const closeFormModal = useCallback(() => {
    setShowFormModal(false);
    setEditingId(null);
    setSubmitting(false);
    resetFormState();
  }, [resetFormState]);

  const openCreateModal = useCallback(() => {
    setStatusMessage(null);
    setEditingId(null);
    resetFormState();
    setShowFormModal(true);
  }, [resetFormState]);

  const openEditModal = useCallback((store: Store) => {
    setStatusMessage(null);
    setEditingId(store.id);
    setFormState({
      name: store.name,
      storeNumber: store.storeNumber,
      format: store.format,
      province: store.province,
      canton: store.canton,
      supervisors: store.supervisors ?? [],
      latitude:
        typeof store.location?.latitude === "number"
          ? store.location.latitude.toString()
          : "",
      longitude:
        typeof store.location?.longitude === "number"
          ? store.location.longitude.toString()
          : "",
      address: store.location?.address ?? "",
      placeId: store.location?.placeId ?? "",
    });
    setPlaceQuery("");
    setPlaceResults([]);
    setShowFormModal(true);
  }, []);

  useEffect(() => {
    if (showFormModal) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [showFormModal]);

  useEffect(() => {
    if (!showFormModal) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFormModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showFormModal, closeFormModal]);

  useEffect(() => {
    if (showFormModal && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [showFormModal]);

  function handleModalBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      closeFormModal();
    }
  }

  async function handleDelete(store: Store) {
    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar la tienda ${store.name} (#${store.storeNumber})?`
    );
    if (!confirmed) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/stores/${store.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "No se pudo eliminar la tienda");
      }

      setStatusMessage({
        type: "success",
        text: "Tienda eliminada correctamente",
      });
      await fetchStores();
    } catch (error) {
      console.error(error);
      setStatusMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al eliminar la tienda",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const latitude = Number(formState.latitude);
    const longitude = Number(formState.longitude);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setStatusMessage({
        type: "error",
        text: "Debes ingresar coordenadas válidas (latitud y longitud)",
      });
      return;
    }

    const payload = {
      name: formState.name,
      storeNumber: formState.storeNumber,
      format: formState.format,
      province: formState.province,
      canton: formState.canton,
      supervisors: formState.supervisors,
      latitude,
      longitude,
      address: formState.address,
      placeId: formState.placeId,
    };

    try {
      setSubmitting(true);
      const response = await fetch(
        editingId ? `/api/stores/${editingId}` : "/api/stores",
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ??
            (editingId
              ? "No se pudo actualizar la tienda"
              : "No se pudo crear la tienda")
        );
      }

      setStatusMessage({
        type: "success",
        text: editingId
          ? "Tienda actualizada correctamente"
          : "Tienda creada correctamente",
      });

      closeFormModal();
      await fetchStores();
    } catch (error) {
      console.error(error);
      setStatusMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al guardar la tienda",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePlaceSearch() {
    if (!placeQuery || placeQuery.trim().length < 3) {
      setStatusMessage({
        type: "error",
        text: "Ingresa al menos 3 caracteres para buscar en Google Places",
      });
      return;
    }

    try {
      setSearchingPlaces(true);
      const response = await fetch(
        `/api/places/search?query=${encodeURIComponent(placeQuery.trim())}`
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "La búsqueda no devolvió resultados");
      }

      setPlaceResults(data.data ?? []);
    } catch (error) {
      console.error(error);
      setStatusMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "No se pudo completar la búsqueda de lugares",
      });
    } finally {
      setSearchingPlaces(false);
    }
  }

  async function handleSelectPlace(placeId: string) {
    try {
      setLoadingPlaceDetails(true);
      const response = await fetch(
        `/api/places/details?placeId=${encodeURIComponent(placeId)}`
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "No se pudieron obtener los detalles");
      }

      const place: PlaceDetails = data.data ?? {};
      const normalizedProvince = place.province?.trim() ?? "";
      const normalizedCanton = place.canton?.trim() ?? "";
      setFormState((prev) => ({
        ...prev,
        name: place.name || prev.name,
        address: place.address || prev.address,
        placeId: place.id || placeId,
        province: normalizedProvince || prev.province,
        canton: normalizedCanton || prev.canton,
        latitude:
          typeof place.location?.latitude === "number"
            ? place.location.latitude.toString()
            : prev.latitude,
        longitude:
          typeof place.location?.longitude === "number"
            ? place.location.longitude.toString()
            : prev.longitude,
      }));
      setStatusMessage({
        type: "success",
        text: "Lugar seleccionado desde Google Places",
      });
      setPlaceResults([]);
      setPlaceQuery(place.name ?? "");
    } catch (error) {
      console.error(error);
      setStatusMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "No se pudieron obtener los detalles del lugar",
      });
    } finally {
      setLoadingPlaceDetails(false);
    }
  }

  const selectedLatitude = useMemo(() => {
    const value = Number(formState.latitude);
    return Number.isFinite(value) ? value : null;
  }, [formState.latitude]);

  const selectedLongitude = useMemo(() => {
    const value = Number(formState.longitude);
    return Number.isFinite(value) ? value : null;
  }, [formState.longitude]);

  return (
    <main className="admin-users-wrapper">
      <div className="container py-5">
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
          <div>
            <h1 className="display-6 fw-bold text-white mb-2">
              Administración de tiendas
            </h1>
            <p className="text-muted mb-0">
              Crea, edita y localiza las tiendas del portafolio con ayuda de
              Google Places.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={openCreateModal}
          >
            Nueva tienda
          </button>
        </div>

        {statusMessage && (
          <div
            className={`alert alert-${
              statusMessage.type === "success" ? "success" : "danger"
            } mb-4`}
            role="alert"
          >
            {statusMessage.text}
          </div>
        )}

        <section>
          <div className="card admin-card shadow-sm border-0">
            <div className="card-body">
              <div className="d-flex flex-wrap gap-3 justify-content-between align-items-center mb-4">
                <div>
                  <h2 className="h4 mb-1">Listado de tiendas</h2>
                  <p className="text-muted mb-0">
                    {loading
                      ? "Cargando tiendas..."
                      : hasStores
                      ? `${stores.length} resultado(s)`
                      : "No hay tiendas registradas"}
                  </p>
                </div>

                <div className="d-flex flex-wrap gap-2">
                  <input
                    type="search"
                    className="form-control admin-filter-search"
                    placeholder="Buscar por nombre, número o provincia"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <select
                    className="form-select"
                    value={formatFilter}
                    onChange={(event) =>
                      setFormatFilter(event.target.value as StoreFormat | "")
                    }
                    aria-label="Filtrar por formato"
                  >
                    <option value="">Todos los formatos</option>
                    {STORE_FORMATS.map((format) => (
                      <option key={format} value={format}>
                        {format}
                      </option>
                    ))}
                  </select>
                  <select
                    className="form-select"
                    value={provinceFilter}
                    onChange={(event) => setProvinceFilter(event.target.value)}
                    aria-label="Filtrar por provincia"
                  >
                    <option value="">Todas las provincias</option>
                    {COSTA_RICA_PROVINCES.map((province) => (
                      <option key={province} value={province}>
                        {province}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-outline-light"
                    onClick={() => void fetchStores()}
                  >
                    Aplicar filtros
                  </button>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-dark table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Nombre</th>
                      <th scope="col">Formato</th>
                      <th scope="col">Provincia</th>
                      <th scope="col">Cantón</th>
                      <th scope="col">Supervisión</th>
                      <th scope="col" className="text-end">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={7} className="text-center py-4">
                          Cargando...
                        </td>
                      </tr>
                    )}

                    {!loading && stores.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-4 text-muted">
                          No se encontraron tiendas con los filtros
                          seleccionados.
                        </td>
                      </tr>
                    )}

                    {!loading &&
                      stores.map((store) => (
                        <tr key={store.id}>
                          <td className="fw-semibold">{store.storeNumber}</td>
                          <td>{store.name}</td>
                          <td>{store.format}</td>
                          <td>{store.province}</td>
                          <td>{store.canton}</td>
                          <td>
                            {store.supervisors &&
                            store.supervisors.length > 0 ? (
                              <div className="d-flex flex-wrap gap-2">
                                {store.supervisors.map((id) => {
                                  const supervisor = supervisorMap.get(id);
                                  return (
                                    <span
                                      key={id}
                                      className="badge rounded-pill bg-primary-subtle text-primary"
                                    >
                                      {supervisor?.nombre ?? "Asignado"}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-muted">Sin asignar</span>
                            )}
                          </td>
                          <td className="text-end">
                            <div className="btn-group" role="group">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-light"
                                onClick={() => openEditModal(store)}
                                disabled={submitting}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => void handleDelete(store)}
                                disabled={submitting}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {showFormModal && (
          <>
            <div
              className="modal fade show d-block admin-modal"
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="storeFormModalTitle"
              onClick={handleModalBackdropClick}
            >
              <div
                className="modal-dialog modal-xl modal-dialog-centered admin-modal-dialog"
                role="document"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="modal-content admin-modal-content admin-card">
                  <div className="modal-header">
                    <h5 className="modal-title" id="storeFormModalTitle">
                      {editingId ? "Editar tienda" : "Crear nueva tienda"}
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Cerrar"
                      onClick={closeFormModal}
                      disabled={submitting}
                    />
                  </div>
                  <form onSubmit={handleSubmit} noValidate>
                    <div className="modal-body">
                      <div className="row g-4">
                        <div className="col-lg-6">
                          <div className="row g-3">
                            <div className="col-12">
                              <label
                                htmlFor="store-name"
                                className="form-label"
                              >
                                Nombre de la tienda
                              </label>
                              <input
                                id="store-name"
                                name="name"
                                className="form-control"
                                value={formState.name}
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    name: event.target.value,
                                  }))
                                }
                                ref={nameInputRef}
                                required
                              />
                            </div>
                            <div className="col-md-6">
                              <label
                                htmlFor="store-number"
                                className="form-label"
                              >
                                Número de tienda
                              </label>
                              <input
                                id="store-number"
                                name="storeNumber"
                                className="form-control"
                                value={formState.storeNumber}
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    storeNumber: event.target.value,
                                  }))
                                }
                                required
                              />
                            </div>
                            <div className="col-md-6">
                              <label
                                htmlFor="store-format"
                                className="form-label"
                              >
                                Formato
                              </label>
                              <select
                                id="store-format"
                                className="form-select"
                                value={formState.format}
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    format: event.target.value as StoreFormat,
                                  }))
                                }
                              >
                                {STORE_FORMATS.map((format) => (
                                  <option key={format} value={format}>
                                    {format}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-md-6">
                              <label
                                htmlFor="store-province"
                                className="form-label"
                              >
                                Provincia
                              </label>
                              <select
                                id="store-province"
                                className="form-select"
                                value={formState.province}
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    province: event.target.value,
                                  }))
                                }
                                required
                              >
                                <option value="">
                                  Selecciona una provincia
                                </option>
                                {COSTA_RICA_PROVINCES.map((province) => (
                                  <option key={province} value={province}>
                                    {province}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-md-6">
                              <label
                                htmlFor="store-canton"
                                className="form-label"
                              >
                                Zona / Cantón
                              </label>
                              <input
                                id="store-canton"
                                className="form-control"
                                value={formState.canton}
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    canton: event.target.value,
                                  }))
                                }
                                required
                              />
                            </div>
                            <div className="col-12">
                              <label
                                htmlFor="store-supervisors"
                                className="form-label"
                              >
                                Supervisor(es)
                              </label>
                              <select
                                id="store-supervisors"
                                className="form-select"
                                value={formState.supervisors}
                                onChange={(event) => {
                                  const selected = Array.from(
                                    event.target.selectedOptions
                                  ).map((option) => option.value);
                                  setFormState((prev) => ({
                                    ...prev,
                                    supervisors: selected,
                                  }));
                                }}
                                multiple
                                size={Math.min(
                                  6,
                                  Math.max(3, supervisors.length)
                                )}
                              >
                                {supervisors.length === 0 ? (
                                  <option value="" disabled>
                                    No hay usuarios con rol supervisor o admin
                                    disponibles
                                  </option>
                                ) : null}
                                {supervisors.map((supervisor) => (
                                  <option
                                    key={supervisor.id}
                                    value={supervisor.id}
                                  >
                                    {supervisor.nombre} ({supervisor.role})
                                  </option>
                                ))}
                              </select>
                              <p className="form-text text-muted mt-1">
                                Puedes seleccionar múltiples supervisores con
                                Ctrl/Cmd + clic.
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-6">
                          <div className="row g-3">
                            <div className="col-12">
                              <label
                                htmlFor="place-search"
                                className="form-label"
                              >
                                Búsqueda con Google Places
                              </label>
                              <div className="input-group">
                                <input
                                  id="place-search"
                                  className="form-control"
                                  placeholder="Ej: Walmart Escazú"
                                  value={placeQuery}
                                  onChange={(event) =>
                                    setPlaceQuery(event.target.value)
                                  }
                                />
                                <button
                                  type="button"
                                  className="btn btn-outline-light"
                                  onClick={() => void handlePlaceSearch()}
                                  disabled={searchingPlaces}
                                >
                                  {searchingPlaces ? "Buscando..." : "Buscar"}
                                </button>
                              </div>
                              {placeResults.length > 0 && (
                                <div className="place-search-results mt-2">
                                  <p className="text-muted small mb-2">
                                    Selecciona un resultado para autocompletar
                                    los datos.
                                  </p>
                                  <ul className="list-group">
                                    {placeResults.map((place) => (
                                      <li
                                        key={place.id}
                                        className="list-group-item bg-transparent text-white"
                                      >
                                        <div className="d-flex justify-content-between align-items-start gap-3">
                                          <div>
                                            <strong>{place.name}</strong>
                                            <div className="small text-muted">
                                              {place.address}
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-primary"
                                            onClick={() =>
                                              void handleSelectPlace(place.id)
                                            }
                                            disabled={loadingPlaceDetails}
                                          >
                                            Usar
                                          </button>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                            <div className="col-12">
                              <label
                                htmlFor="store-address"
                                className="form-label"
                              >
                                Dirección o referencia
                              </label>
                              <textarea
                                id="store-address"
                                className="form-control"
                                rows={3}
                                value={formState.address}
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    address: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="col-sm-6">
                              <label
                                htmlFor="store-latitude"
                                className="form-label"
                              >
                                Latitud
                              </label>
                              <input
                                id="store-latitude"
                                className="form-control"
                                inputMode="decimal"
                                value={formState.latitude}
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    latitude: event.target.value,
                                  }))
                                }
                                required
                              />
                            </div>
                            <div className="col-sm-6">
                              <label
                                htmlFor="store-longitude"
                                className="form-label"
                              >
                                Longitud
                              </label>
                              <input
                                id="store-longitude"
                                className="form-control"
                                inputMode="decimal"
                                value={formState.longitude}
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    longitude: event.target.value,
                                  }))
                                }
                                required
                              />
                            </div>
                            <div className="col-12">
                              <StoreLocationMap
                                latitude={selectedLatitude}
                                longitude={selectedLongitude}
                                name={formState.name}
                                address={formState.address}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={closeFormModal}
                        disabled={submitting}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={submitting}
                      >
                        {submitting
                          ? "Guardando..."
                          : editingId
                          ? "Actualizar tienda"
                          : "Crear tienda"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
            <div className="modal-backdrop fade show admin-modal-backdrop" />
          </>
        )}
      </div>
    </main>
  );
}
