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
import type { RouteMapStore } from "@/components/admin/RouteMap";

const RouteMap = dynamic(() => import("@/components/admin/RouteMap"), {
  ssr: false,
});

type RouteStore = {
  storeId: string;
  name: string;
  storeNumber: string;
  format?: string;
  province?: string;
  canton?: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
};

type RouteLeg = {
  fromStoreId: string;
  toStoreId: string;
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
};

type Route = {
  id: string;
  name: string;
  description: string;
  storeIds: string[];
  stores: RouteStore[];
  supervisors: string[];
  assignees: string[];
  overviewPolyline: string | null;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  legs: RouteLeg[];
  createdAt: string;
  updatedAt: string;
};

type StoreOption = {
  id: string;
  name: string;
  storeNumber: string;
  format?: string;
  province?: string;
  canton?: string;
  location: {
    latitude: number | null;
    longitude: number | null;
    address?: string;
  };
};

type UserOption = {
  id: string;
  nombre: string;
  email: string;
  role: "admin" | "supervisor" | "usuario";
};

type StatusMessage = {
  type: "success" | "error";
  text: string;
};

interface RouteFormState {
  name: string;
  description: string;
  storeIds: string[];
  supervisors: string[];
  assignees: string[];
}

const emptyFormState: RouteFormState = {
  name: "",
  description: "",
  storeIds: [],
  supervisors: [],
  assignees: [],
};

function formatKilometers(value: number) {
  return value.toLocaleString("es-CR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDurationMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  if (hours <= 0) {
    return `${minutes} min`;
  }
  return `${hours} h ${minutes} min`;
}

export default function AdminRoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null
  );
  const [showFormModal, setShowFormModal] = useState(false);
  const [formState, setFormState] = useState<RouteFormState>(emptyFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [storeOptions, setStoreOptions] = useState<StoreOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedStoreToAdd, setSelectedStoreToAdd] = useState("");

  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const supervisorOptions = useMemo(
    () =>
      users.filter(
        (user) => user.role === "admin" || user.role === "supervisor"
      ),
    [users]
  );

  const userMap = useMemo(() => {
    return users.reduce<Map<string, UserOption>>((map, user) => {
      map.set(user.id, user);
      return map;
    }, new Map());
  }, [users]);

  const storeMap = useMemo(() => {
    return storeOptions.reduce<Map<string, StoreOption>>((map, store) => {
      map.set(store.id, store);
      return map;
    }, new Map());
  }, [storeOptions]);

  const hasRoutes = routes.length > 0;

  const totalKilometers = useMemo(
    () => routes.reduce((sum, route) => sum + (route.totalDistanceKm ?? 0), 0),
    [routes]
  );

  const selectedStores = useMemo(() => {
    return formState.storeIds
      .map((id) => storeMap.get(id))
      .filter((store): store is StoreOption => Boolean(store));
  }, [formState.storeIds, storeMap]);

  const previewRouteStores = useMemo(() => {
    const result: RouteMapStore[] = [];

    selectedStores.forEach((store) => {
      const latitude = Number(store.location?.latitude);
      const longitude = Number(store.location?.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      result.push({
        storeId: store.id,
        name: store.name,
        storeNumber: store.storeNumber,
        location: {
          latitude,
          longitude,
          address: store.location?.address,
        },
      });
    });

    return result;
  }, [selectedStores]);

  const availableStoreOptions = useMemo(() => {
    return storeOptions.filter(
      (store) => !formState.storeIds.includes(store.id)
    );
  }, [storeOptions, formState.storeIds]);

  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) {
        params.set("search", searchTerm);
      }

      const query = params.toString();
      const response = await fetch(
        query ? `/api/routes?${query}` : "/api/routes"
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "No se pudieron obtener las rutas");
      }

      setRoutes(data.data ?? []);
    } catch (error) {
      console.error(error);
      setStatusMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al cargar las rutas",
      });
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  const fetchStores = useCallback(async () => {
    try {
      const response = await fetch("/api/stores");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "No se pudieron obtener las tiendas");
      }

      setStoreOptions(data.data ?? []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/users");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "No se pudieron obtener los usuarios");
      }

      setUsers(data.data ?? []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    void fetchRoutes();
  }, [fetchRoutes]);

  useEffect(() => {
    void fetchStores();
  }, [fetchStores]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const resetFormState = useCallback(() => {
    setFormState(emptyFormState);
    setSelectedStoreToAdd("");
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

  const openEditModal = useCallback((route: Route) => {
    setStatusMessage(null);
    setEditingId(route.id);
    setFormState({
      name: route.name,
      description: route.description,
      storeIds: route.storeIds,
      supervisors: route.supervisors,
      assignees: route.assignees,
    });
    setSelectedStoreToAdd("");
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
    if (showFormModal && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [showFormModal]);

  function handleModalBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      closeFormModal();
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
  }

  function handleResetSearch() {
    setSearchInput("");
    setSearchTerm("");
  }

  function handleAddStore() {
    if (!selectedStoreToAdd) {
      return;
    }

    setFormState((prev) => {
      if (prev.storeIds.includes(selectedStoreToAdd)) {
        return prev;
      }
      return {
        ...prev,
        storeIds: [...prev.storeIds, selectedStoreToAdd],
      };
    });

    setSelectedStoreToAdd("");
  }

  function handleRemoveStore(storeId: string) {
    setFormState((prev) => ({
      ...prev,
      storeIds: prev.storeIds.filter((id) => id !== storeId),
    }));
  }

  function handleMoveStore(storeId: string, direction: "up" | "down") {
    setFormState((prev) => {
      const index = prev.storeIds.indexOf(storeId);
      if (index === -1) {
        return prev;
      }

      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.storeIds.length) {
        return prev;
      }

      const newStoreIds = [...prev.storeIds];
      const temp = newStoreIds[index];
      newStoreIds[index] = newStoreIds[newIndex];
      newStoreIds[newIndex] = temp;

      return {
        ...prev,
        storeIds: newStoreIds,
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = formState.name.trim();
    const trimmedDescription = formState.description.trim();

    if (!trimmedName) {
      setStatusMessage({
        type: "error",
        text: "Debes ingresar un nombre para la ruta",
      });
      return;
    }

    if (formState.storeIds.length === 0) {
      setStatusMessage({
        type: "error",
        text: "Selecciona al menos una tienda para la ruta",
      });
      return;
    }

    const payload = {
      name: trimmedName,
      description: trimmedDescription,
      storeIds: formState.storeIds,
      supervisors: formState.supervisors,
      assignees: formState.assignees,
    };

    try {
      setSubmitting(true);
      const response = await fetch(
        editingId ? `/api/routes/${editingId}` : "/api/routes",
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
              ? "No se pudo actualizar la ruta"
              : "No se pudo crear la ruta")
        );
      }

      setStatusMessage({
        type: "success",
        text: editingId
          ? "Ruta actualizada correctamente"
          : "Ruta creada correctamente",
      });

      closeFormModal();
      await fetchRoutes();
    } catch (error) {
      console.error(error);
      setStatusMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al guardar la ruta",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(route: Route) {
    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar la ruta "${route.name}"?`
    );
    if (!confirmed) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/routes/${route.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "No se pudo eliminar la ruta");
      }

      setStatusMessage({
        type: "success",
        text: "Ruta eliminada correctamente",
      });

      await fetchRoutes();
    } catch (error) {
      console.error(error);
      setStatusMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al eliminar la ruta",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="container py-5">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h1 className="h3 fw-semibold mb-1 text-white">Gestión de rutas</h1>
          <p className="text-muted mb-0">
            Crea recorridos, asigna supervisores y colaboradores, y visualiza el
            trayecto en el mapa.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          Nueva ruta
        </button>
      </div>

      <div className="card bg-transparent border-0 mb-4">
        <div className="card-body bg-surface rounded-4 p-4">
          <form
            className="row gy-3 align-items-center"
            onSubmit={handleSearchSubmit}
          >
            <div className="col-md-5">
              <label htmlFor="route-search" className="form-label mb-1">
                Buscar rutas
              </label>
              <input
                id="route-search"
                className="form-control"
                placeholder="Nombre de ruta o palabra clave"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <div className="col-md-4 d-flex gap-2 align-items-end">
              <button
                type="submit"
                className="btn btn-outline-light flex-grow-1"
              >
                Aplicar filtros
              </button>
              <button
                type="button"
                className="btn btn-outline-light"
                onClick={handleResetSearch}
              >
                Limpiar
              </button>
            </div>
            <div className="col-md-3 text-md-end">
              <div className="small text-muted">
                {hasRoutes
                  ? `Total de rutas: ${
                      routes.length
                    } · Distancia acumulada: ${formatKilometers(
                      totalKilometers
                    )} km`
                  : "Sin rutas registradas"}
              </div>
            </div>
          </form>
        </div>
      </div>

      {statusMessage ? (
        <div
          className={`alert alert-${
            statusMessage.type === "success" ? "success" : "danger"
          } rounded-4`}
        >
          {statusMessage.text}
        </div>
      ) : null}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
          <p className="mt-3 text-muted">Cargando rutas…</p>
        </div>
      ) : null}

      {!loading && !hasRoutes ? (
        <div className="text-center py-5 text-muted">
          <p className="mb-2">Todavía no has registrado rutas.</p>
          <p className="mb-0">
            Crea la primera ruta para comenzar a planificar recorridos.
          </p>
        </div>
      ) : null}

      <div className="d-grid gap-4">
        {routes.map((route) => {
          const routeStoreMap = new Map(
            route.stores.map((store) => [store.storeId, store])
          );

          return (
            <div key={route.id} className="route-card card border-0">
              <div className="card-body p-4 p-lg-5">
                <div className="d-flex flex-column flex-lg-row gap-4 justify-content-between align-items-lg-start">
                  <div className="flex-grow-1">
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                      <h2 className="h4 mb-0 text-white">{route.name}</h2>
                      <span className="badge bg-primary-subtle text-primary">
                        {formatKilometers(route.totalDistanceKm)} km
                      </span>
                      <span className="badge bg-light text-dark">
                        {formatDurationMinutes(route.totalDurationMinutes)}
                      </span>
                    </div>
                    {route.description ? (
                      <p className="text-muted mb-3">{route.description}</p>
                    ) : null}
                    <div className="mb-3">
                      <h3 className="h6 text-uppercase text-muted mb-2">
                        Itinerario
                      </h3>
                      <div className="d-flex flex-wrap gap-2">
                        {route.stores.map((store, index) => (
                          <span key={store.storeId} className="route-chip">
                            <span className="route-chip-index">
                              {index + 1}
                            </span>
                            <span>{store.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <h3 className="h6 text-uppercase text-muted mb-2">
                          Supervisores
                        </h3>
                        <div className="d-flex flex-wrap gap-2">
                          {route.supervisors.length > 0 ? (
                            route.supervisors.map((id) => (
                              <span key={id} className="route-chip">
                                <span className="route-chip-dot" />
                                {userMap.get(id)?.nombre ?? "Usuario"}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted small">
                              Sin supervisores asignados
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="col-md-6">
                        <h3 className="h6 text-uppercase text-muted mb-2">
                          Colaboradores
                        </h3>
                        <div className="d-flex flex-wrap gap-2">
                          {route.assignees.length > 0 ? (
                            route.assignees.map((id) => (
                              <span
                                key={id}
                                className="route-chip route-chip--secondary"
                              >
                                <span className="route-chip-dot" />
                                {userMap.get(id)?.nombre ?? "Usuario"}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted small">
                              Sin colaboradores asignados
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 small text-muted">
                      Última actualización:{" "}
                      {new Date(route.updatedAt).toLocaleString("es-CR")}
                    </div>
                  </div>
                  <div className="d-flex flex-column gap-2 align-self-stretch">
                    <button
                      className="btn btn-outline-light"
                      onClick={() => openEditModal(route)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-outline-danger"
                      onClick={() => handleDelete(route)}
                      disabled={submitting}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <RouteMap
                    stores={route.stores.map((store) => ({
                      storeId: store.storeId,
                      name: store.name,
                      storeNumber: store.storeNumber,
                      location: store.location,
                    }))}
                    polyline={route.overviewPolyline}
                  />
                </div>

                {route.legs.length > 0 ? (
                  <div className="mt-4">
                    <h3 className="h6 text-uppercase text-muted mb-3">
                      Detalle de tramos
                    </h3>
                    <div className="table-responsive rounded-4 overflow-hidden">
                      <table className="table table-dark table-sm align-middle mb-0">
                        <thead>
                          <tr className="text-uppercase small text-muted">
                            <th scope="col">#</th>
                            <th scope="col">Desde</th>
                            <th scope="col">Hasta</th>
                            <th scope="col">Distancia</th>
                            <th scope="col">Duración</th>
                          </tr>
                        </thead>
                        <tbody>
                          {route.legs.map((leg, index) => {
                            const fromStore = routeStoreMap.get(
                              leg.fromStoreId
                            );
                            const toStore = routeStoreMap.get(leg.toStoreId);
                            return (
                              <tr
                                key={`${leg.fromStoreId}-${leg.toStoreId}-${index}`}
                              >
                                <td>{index + 1}</td>
                                <td>{fromStore?.name ?? leg.fromStoreId}</td>
                                <td>{toStore?.name ?? leg.toStoreId}</td>
                                <td>{leg.distanceText}</td>
                                <td>{leg.durationText}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {showFormModal ? <div className="modal-backdrop fade show" /> : null}

      {showFormModal ? (
        <div
          className="modal d-block"
          role="dialog"
          aria-modal="true"
          onMouseDown={handleModalBackdropClick}
        >
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content bg-surface">
              <div className="modal-header border-0">
                <h5 className="modal-title">
                  {editingId ? "Editar ruta" : "Nueva ruta"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Cerrar"
                  onClick={closeFormModal}
                />
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row g-4">
                    <div className="col-lg-5">
                      <div className="card bg-transparent border-0">
                        <div className="card-body p-0 d-grid gap-3">
                          <div>
                            <label className="form-label" htmlFor="route-name">
                              Nombre de la ruta
                            </label>
                            <input
                              id="route-name"
                              ref={nameInputRef}
                              className="form-control"
                              value={formState.name}
                              onChange={(event) =>
                                setFormState((prev) => ({
                                  ...prev,
                                  name: event.target.value,
                                }))
                              }
                              placeholder="Ej. Ruta Pacífico"
                            />
                          </div>
                          <div>
                            <label
                              className="form-label"
                              htmlFor="route-description"
                            >
                              Descripción
                            </label>
                            <textarea
                              id="route-description"
                              className="form-control"
                              rows={4}
                              value={formState.description}
                              onChange={(event) =>
                                setFormState((prev) => ({
                                  ...prev,
                                  description: event.target.value,
                                }))
                              }
                              placeholder="Notas sobre horarios, ventanas de visita o restricciones"
                            />
                          </div>
                          <div>
                            <label
                              className="form-label"
                              htmlFor="route-supervisors"
                            >
                              Supervisores encargados
                            </label>
                            <select
                              id="route-supervisors"
                              className="form-select"
                              multiple
                              value={formState.supervisors}
                              onChange={(event) => {
                                const values = Array.from(
                                  event.target.selectedOptions,
                                  (option) => option.value
                                );
                                setFormState((prev) => ({
                                  ...prev,
                                  supervisors: values,
                                }));
                              }}
                            >
                              {supervisorOptions.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.nombre} ({user.role})
                                </option>
                              ))}
                            </select>
                            <small className="text-muted">
                              Puedes seleccionar múltiples responsables (Ctrl/⌘
                              + clic).
                            </small>
                          </div>
                          <div>
                            <label
                              className="form-label"
                              htmlFor="route-assignees"
                            >
                              Colaboradores asignados
                            </label>
                            <select
                              id="route-assignees"
                              className="form-select"
                              multiple
                              value={formState.assignees}
                              onChange={(event) => {
                                const values = Array.from(
                                  event.target.selectedOptions,
                                  (option) => option.value
                                );
                                setFormState((prev) => ({
                                  ...prev,
                                  assignees: values,
                                }));
                              }}
                            >
                              {users.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.nombre} ({user.role})
                                </option>
                              ))}
                            </select>
                            <small className="text-muted">
                              Incluye al personal que recorrerá la ruta.
                            </small>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-lg-7">
                      <div className="card bg-transparent border-0 h-100">
                        <div className="card-body p-0 d-grid gap-3 h-100">
                          <div className="d-grid gap-3">
                            <div>
                              <label
                                className="form-label"
                                htmlFor="route-store-selector"
                              >
                                Agregar tienda
                              </label>
                              <div className="d-flex gap-2">
                                <select
                                  id="route-store-selector"
                                  className="form-select"
                                  value={selectedStoreToAdd}
                                  onChange={(event) =>
                                    setSelectedStoreToAdd(event.target.value)
                                  }
                                >
                                  <option value="">
                                    Selecciona una tienda…
                                  </option>
                                  {availableStoreOptions.map((store) => (
                                    <option key={store.id} value={store.id}>
                                      {store.name} • #{store.storeNumber}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="btn btn-outline-light"
                                  onClick={handleAddStore}
                                  disabled={!selectedStoreToAdd}
                                >
                                  Agregar
                                </button>
                              </div>
                            </div>
                            <div className="route-store-list card bg-surface-light border-0">
                              <div className="card-body">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                  <h3 className="h6 text-uppercase text-muted mb-0">
                                    Orden del recorrido
                                  </h3>
                                  <span className="badge bg-primary-subtle text-primary">
                                    {formState.storeIds.length} puntos
                                  </span>
                                </div>
                                {selectedStores.length > 0 ? (
                                  <div className="d-grid gap-2">
                                    {selectedStores.map((store, index) => (
                                      <div
                                        key={store.id}
                                        className="route-store-item d-flex align-items-center justify-content-between rounded-3 p-3"
                                      >
                                        <div>
                                          <div className="fw-semibold text-white">
                                            {index + 1}. {store.name}
                                          </div>
                                          <div className="small text-muted">
                                            #{store.storeNumber} ·{" "}
                                            {store.province ??
                                              "Provincia desconocida"}
                                          </div>
                                        </div>
                                        <div className="btn-group btn-group-sm">
                                          <button
                                            type="button"
                                            className="btn btn-outline-light"
                                            onClick={() =>
                                              handleMoveStore(store.id, "up")
                                            }
                                            disabled={index === 0}
                                          >
                                            ↑
                                          </button>
                                          <button
                                            type="button"
                                            className="btn btn-outline-light"
                                            onClick={() =>
                                              handleMoveStore(store.id, "down")
                                            }
                                            disabled={
                                              index ===
                                              selectedStores.length - 1
                                            }
                                          >
                                            ↓
                                          </button>
                                          <button
                                            type="button"
                                            className="btn btn-outline-danger"
                                            onClick={() =>
                                              handleRemoveStore(store.id)
                                            }
                                          >
                                            ×
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center text-muted py-4">
                                    Aún no has agregado tiendas a la ruta.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex-grow-1">
                            <RouteMap
                              stores={previewRouteStores}
                              polyline={null}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-0 d-flex justify-content-end gap-3">
                  <button
                    type="button"
                    className="btn btn-outline-light"
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
                      ? "Guardando…"
                      : editingId
                      ? "Actualizar"
                      : "Crear"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
