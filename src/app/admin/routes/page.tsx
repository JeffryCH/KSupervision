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
import AdminGuard from "@/components/admin/AdminGuard";
import { useUserSession } from "@/hooks/useUserSession";
import type { RouteMapStore } from "@/components/admin/RouteMap";

const RouteMap = dynamic(
  () => import("@/components/admin/RouteMap").then((mod) => mod.default),
  { ssr: false }
);

interface RouteLeg {
  fromStoreId: string;
  toStoreId: string;
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
}

interface RouteStore {
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
}

type DayId =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

const DAY_OPTIONS: Array<{ id: DayId; label: string; short: string }> = [
  { id: "monday", label: "Lunes", short: "Lun" },
  { id: "tuesday", label: "Martes", short: "Mar" },
  { id: "wednesday", label: "Miércoles", short: "Mié" },
  { id: "thursday", label: "Jueves", short: "Jue" },
  { id: "friday", label: "Viernes", short: "Vie" },
  { id: "saturday", label: "Sábado", short: "Sáb" },
  { id: "sunday", label: "Domingo", short: "Dom" },
];

interface RouteWorkPlanVisit {
  storeId: string;
  startTime: string | null;
  notes: string;
}

interface RouteWorkPlanDay {
  dayId: DayId;
  visits: RouteWorkPlanVisit[];
}

interface RouteWorkPlan {
  startDate: string | null;
  generalNotes: string;
  days: RouteWorkPlanDay[];
}

interface RouteVisitStats {
  totalWeeklyVisits: number;
  averageVisitsPerStore: number;
  stores: Array<{
    storeId: string;
    visitsPerWeek: number;
  }>;
}

function createEmptyWorkPlan(): RouteWorkPlan {
  return {
    startDate: null,
    generalNotes: "",
    days: DAY_OPTIONS.map(({ id }) => ({
      dayId: id,
      visits: [],
    })),
  };
}

function getDayMeta(dayId: DayId) {
  return DAY_OPTIONS.find((option) => option.id === dayId) ?? DAY_OPTIONS[0];
}

function buildPlanState(
  source: RouteWorkPlan | null | undefined,
  storeIds: string[]
): RouteWorkPlan {
  const allowedStores = new Set(storeIds);

  return {
    startDate: source?.startDate ?? null,
    generalNotes: source?.generalNotes ?? "",
    days: DAY_OPTIONS.map(({ id }) => {
      const dayVisits =
        source?.days.find((day) => day.dayId === id)?.visits ?? [];
      const visits = dayVisits
        .filter((visit) => allowedStores.has(visit.storeId))
        .map((visit) => ({
          storeId: visit.storeId,
          startTime: visit.startTime ?? null,
          notes: visit.notes ?? "",
        }));

      return {
        dayId: id,
        visits,
      } satisfies RouteWorkPlanDay;
    }),
  } satisfies RouteWorkPlan;
}

function buildEmptyWorkPlanSelections(): Record<DayId, string> {
  const selections = {} as Record<DayId, string>;
  DAY_OPTIONS.forEach(({ id }) => {
    selections[id] = "";
  });
  return selections;
}

function buildWorkPlanPayload(plan: RouteWorkPlan) {
  const trimmedNotes = plan.generalNotes.trim();

  const days = plan.days
    .map((day) => ({
      dayId: day.dayId,
      visits: day.visits
        .filter((visit) => visit.storeId)
        .map((visit) => ({
          storeId: visit.storeId,
          startTime: visit.startTime ? visit.startTime.trim() : null,
          notes: visit.notes.trim(),
        })),
    }))
    .filter((day) => day.visits.length > 0);

  return {
    startDate: plan.startDate,
    generalNotes: trimmedNotes,
    days,
    frequency: "weekly" as const,
  };
}

function countPlannedVisits(plan: RouteWorkPlan) {
  return plan.days.reduce((total, day) => total + day.visits.length, 0);
}

interface Route {
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
  workPlan: RouteWorkPlan | null;
  visitStats: RouteVisitStats;
}

interface RouteFormState {
  name: string;
  description: string;
  storeIds: string[];
  supervisors: string[];
  workPlan: RouteWorkPlan;
}

type StatusMessage = {
  type: "success" | "error";
  text: string;
};

interface StoreOption {
  id: string;
  name: string;
  storeNumber: string;
  format?: string;
  province?: string;
  canton?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
}

interface UserSummary {
  id: string;
  nombre: string;
  role: "admin" | "supervisor" | "usuario";
}

interface UsersApiResponse {
  id?: string;
  nombre?: string;
  role?: string;
}

interface StoresApiResponse {
  id?: string;
  name?: string;
  storeNumber?: string;
  format?: string;
  province?: string;
  canton?: string;
  location?: {
    latitude?: number | null;
    longitude?: number | null;
    address?: string | null;
  };
}

function getEmptyFormState(): RouteFormState {
  return {
    name: "",
    description: "",
    storeIds: [],
    supervisors: [],
    workPlan: createEmptyWorkPlan(),
  };
}

function formatKilometers(value: number) {
  if (!Number.isFinite(value)) {
    return "0.0";
  }

  return value.toLocaleString("es-CR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatDurationMinutes(value: number) {
  if (!Number.isFinite(value)) {
    return "0 min";
  }

  const totalMinutes = Math.max(0, Math.round(value));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  }

  return `${minutes} min`;
}

export default function AdminRoutesPage() {
  const { user: sessionUser, isLoading: sessionLoading } = useUserSession();
  const isAdmin = sessionUser?.role?.toLowerCase() === "admin";
  const supervisorFilterId = !isAdmin ? sessionUser?.id ?? "" : "";

  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null
  );

  const [showFormModal, setShowFormModal] = useState(false);
  const [formState, setFormState] = useState<RouteFormState>(() =>
    getEmptyFormState()
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [storeOptions, setStoreOptions] = useState<StoreOption[]>([]);
  const [selectedStoreToAdd, setSelectedStoreToAdd] = useState("");
  const [workPlanSelections, setWorkPlanSelections] = useState<
    Record<DayId, string>
  >(() => buildEmptyWorkPlanSelections());
  const [users, setUsers] = useState<UserSummary[]>([]);

  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const userMap = useMemo(() => {
    const map = new Map<string, UserSummary>();
    users.forEach((user) => {
      map.set(user.id, user);
    });
    return map;
  }, [users]);

  const supervisorOptions = useMemo(() => {
    return users
      .filter((user) => user.role === "admin" || user.role === "supervisor")
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [users]);

  const selectedStores = useMemo(() => {
    if (formState.storeIds.length === 0) {
      return [] as StoreOption[];
    }

    const map = new Map(storeOptions.map((store) => [store.id, store]));
    return formState.storeIds
      .map((id) => map.get(id))
      .filter((store): store is StoreOption => Boolean(store));
  }, [formState.storeIds, storeOptions]);

  const availableStoreOptions = useMemo(() => {
    if (storeOptions.length === 0) {
      return [] as StoreOption[];
    }

    const selected = new Set(formState.storeIds);
    return storeOptions
      .filter((store) => !selected.has(store.id))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [storeOptions, formState.storeIds]);

  const previewRouteStores = useMemo<RouteMapStore[]>(() => {
    const result: RouteMapStore[] = [];

    selectedStores.forEach((store) => {
      const latitude =
        typeof store.latitude === "number" && Number.isFinite(store.latitude)
          ? store.latitude
          : null;
      const longitude =
        typeof store.longitude === "number" && Number.isFinite(store.longitude)
          ? store.longitude
          : null;

      if (latitude === null || longitude === null) {
        return;
      }

      result.push({
        storeId: store.id,
        name: store.name,
        storeNumber: store.storeNumber,
        location: {
          latitude,
          longitude,
          address: store.address ?? undefined,
        },
      });
    });

    return result;
  }, [selectedStores]);

  const hasRoutes = routes.length > 0;

  const totalKilometers = useMemo(() => {
    return routes.reduce((acc, route) => {
      return (
        acc +
        (Number.isFinite(route.totalDistanceKm) ? route.totalDistanceKm : 0)
      );
    }, 0);
  }, [routes]);

  const fetchRoutes = useCallback(async () => {
    if (sessionLoading) {
      return;
    }

    if (!isAdmin && !supervisorFilterId) {
      setRoutes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      const trimmedSearch = searchTerm.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      if (!isAdmin) {
        params.set("supervisorId", supervisorFilterId);
      }

      const query = params.toString();
      const response = await fetch(
        query ? `/api/routes?${query}` : "/api/routes"
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "No se pudieron obtener las rutas");
      }

      setRoutes(Array.isArray(data.data) ? (data.data as Route[]) : []);
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
  }, [searchTerm, isAdmin, supervisorFilterId, sessionLoading]);

  const fetchStores = useCallback(async () => {
    if (sessionLoading) {
      return;
    }

    if (!isAdmin && !supervisorFilterId) {
      setStoreOptions([]);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (!isAdmin) {
        params.set("supervisorId", supervisorFilterId);
      }

      const query = params.toString();
      const response = await fetch(
        query ? `/api/stores?${query}` : "/api/stores"
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "No se pudieron obtener las tiendas");
      }

      const items = (
        Array.isArray(data.data) ? data.data : []
      ) as StoresApiResponse[];
      setStoreOptions(
        items.map((item) => {
          const latitude =
            typeof item.location?.latitude === "number" &&
            Number.isFinite(item.location.latitude)
              ? item.location.latitude
              : null;
          const longitude =
            typeof item.location?.longitude === "number" &&
            Number.isFinite(item.location.longitude)
              ? item.location.longitude
              : null;

          return {
            id: String(item.id ?? ""),
            name: String(item.name ?? ""),
            storeNumber: String(item.storeNumber ?? ""),
            format: item.format ?? undefined,
            province: item.province ?? undefined,
            canton: item.canton ?? undefined,
            latitude,
            longitude,
            address: item.location?.address ?? null,
          } satisfies StoreOption;
        })
      );
    } catch (error) {
      console.error(error);
    }
  }, [isAdmin, supervisorFilterId, sessionLoading]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/users");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "No se pudieron obtener los usuarios");
      }

      const items = (
        Array.isArray(data.data) ? data.data : []
      ) as UsersApiResponse[];
      setUsers(
        items.map((item) => {
          const normalizedRole =
            typeof item.role === "string" ? item.role.toLowerCase() : "usuario";
          const role: UserSummary["role"] =
            normalizedRole === "admin" || normalizedRole === "supervisor"
              ? (normalizedRole as UserSummary["role"])
              : "usuario";

          return {
            id: String(item.id ?? ""),
            nombre: String(item.nombre ?? ""),
            role,
          } satisfies UserSummary;
        })
      );
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

  const resetFormState = useCallback(() => {
    setFormState(getEmptyFormState());
    setSelectedStoreToAdd("");
    setWorkPlanSelections(buildEmptyWorkPlanSelections());
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
    const nextWorkPlan = buildPlanState(route.workPlan, route.storeIds);
    setFormState({
      name: route.name,
      description: route.description ?? "",
      storeIds: [...route.storeIds],
      supervisors: [...route.supervisors],
      workPlan: nextWorkPlan,
    });
    setSelectedStoreToAdd("");
    setWorkPlanSelections(buildEmptyWorkPlanSelections());
    setShowFormModal(true);
  }, []);

  const handleModalBackdropClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        closeFormModal();
      }
    },
    [closeFormModal]
  );

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setStatusMessage(null);
      setSearchTerm(searchInput.trim());
    },
    [searchInput]
  );

  const handleResetSearch = useCallback(() => {
    setStatusMessage(null);
    setSearchInput("");
    setSearchTerm("");
  }, []);

  const handleAddStore = useCallback(() => {
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
  }, [selectedStoreToAdd]);

  const handleRemoveStore = useCallback((storeId: string) => {
    setFormState((prev) => ({
      ...prev,
      storeIds: prev.storeIds.filter((id) => id !== storeId),
      workPlan: {
        ...prev.workPlan,
        days: prev.workPlan.days.map((day) => ({
          ...day,
          visits: day.visits.filter((visit) => visit.storeId !== storeId),
        })),
      },
    }));
  }, []);

  const handleMoveStore = useCallback(
    (storeId: string, direction: "up" | "down") => {
      setFormState((prev) => {
        const index = prev.storeIds.indexOf(storeId);
        if (index === -1) {
          return prev;
        }

        const newIndex = direction === "up" ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= prev.storeIds.length) {
          return prev;
        }

        const nextStoreIds = [...prev.storeIds];
        const temp = nextStoreIds[index];
        nextStoreIds[index] = nextStoreIds[newIndex];
        nextStoreIds[newIndex] = temp;

        return {
          ...prev,
          storeIds: nextStoreIds,
        };
      });
    },
    []
  );

  const handleWorkPlanStartDateChange = useCallback((value: string) => {
    setFormState((prev) => ({
      ...prev,
      workPlan: {
        ...prev.workPlan,
        startDate: value ? value : null,
      },
    }));
  }, []);

  const handleWorkPlanNotesChange = useCallback((value: string) => {
    setFormState((prev) => ({
      ...prev,
      workPlan: {
        ...prev.workPlan,
        generalNotes: value,
      },
    }));
  }, []);

  const handleSelectStoreForDay = useCallback((dayId: DayId, value: string) => {
    setWorkPlanSelections((prev) => ({
      ...prev,
      [dayId]: value,
    }));
  }, []);

  const handleAddVisitToDay = useCallback(
    (dayId: DayId) => {
      const storeId = workPlanSelections[dayId];
      if (!storeId) {
        return;
      }

      setFormState((prev) => {
        if (!prev.storeIds.includes(storeId)) {
          return prev;
        }

        return {
          ...prev,
          workPlan: {
            ...prev.workPlan,
            days: prev.workPlan.days.map((day) =>
              day.dayId === dayId
                ? {
                    ...day,
                    visits: [
                      ...day.visits,
                      { storeId, startTime: null, notes: "" },
                    ],
                  }
                : day
            ),
          },
        };
      });

      setWorkPlanSelections((prev) => ({
        ...prev,
        [dayId]: "",
      }));
    },
    [workPlanSelections]
  );

  const handleVisitStoreChange = useCallback(
    (dayId: DayId, index: number, storeId: string) => {
      if (!storeId) {
        return;
      }

      setFormState((prev) => {
        if (!prev.storeIds.includes(storeId)) {
          return prev;
        }

        return {
          ...prev,
          workPlan: {
            ...prev.workPlan,
            days: prev.workPlan.days.map((day) => {
              if (day.dayId !== dayId) {
                return day;
              }
              return {
                ...day,
                visits: day.visits.map((visit, visitIndex) =>
                  visitIndex === index ? { ...visit, storeId } : visit
                ),
              };
            }),
          },
        };
      });
    },
    []
  );

  const handleVisitTimeChange = useCallback(
    (dayId: DayId, index: number, value: string) => {
      setFormState((prev) => ({
        ...prev,
        workPlan: {
          ...prev.workPlan,
          days: prev.workPlan.days.map((day) => {
            if (day.dayId !== dayId) {
              return day;
            }
            return {
              ...day,
              visits: day.visits.map((visit, visitIndex) =>
                visitIndex === index
                  ? { ...visit, startTime: value ? value : null }
                  : visit
              ),
            };
          }),
        },
      }));
    },
    []
  );

  const handleVisitNotesChange = useCallback(
    (dayId: DayId, index: number, value: string) => {
      setFormState((prev) => ({
        ...prev,
        workPlan: {
          ...prev.workPlan,
          days: prev.workPlan.days.map((day) => {
            if (day.dayId !== dayId) {
              return day;
            }
            return {
              ...day,
              visits: day.visits.map((visit, visitIndex) =>
                visitIndex === index ? { ...visit, notes: value } : visit
              ),
            };
          }),
        },
      }));
    },
    []
  );

  const handleRemoveVisit = useCallback((dayId: DayId, index: number) => {
    setFormState((prev) => ({
      ...prev,
      workPlan: {
        ...prev.workPlan,
        days: prev.workPlan.days.map((day) => {
          if (day.dayId !== dayId) {
            return day;
          }
          return {
            ...day,
            visits: day.visits.filter((_, visitIndex) => visitIndex !== index),
          };
        }),
      },
    }));
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const name = formState.name.trim();
      const description = formState.description.trim();

      if (!name) {
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

      if (countPlannedVisits(formState.workPlan) === 0) {
        setStatusMessage({
          type: "error",
          text: "Planifica al menos una visita antes de guardar la ruta",
        });
        return;
      }

      const workPlanPayload = buildWorkPlanPayload(formState.workPlan);

      const payload = {
        name,
        description,
        storeIds: formState.storeIds,
        supervisors: formState.supervisors,
        workPlan: workPlanPayload,
      };

      try {
        setSubmitting(true);
        const response = await fetch(
          editingId ? `/api/routes/${editingId}` : "/api/routes",
          {
            method: editingId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
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
    },
    [formState, editingId, closeFormModal, fetchRoutes]
  );

  const handleDelete = useCallback(
    async (route: Route) => {
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
    },
    [fetchRoutes]
  );

  return (
    <AdminGuard>
      <main className="admin-users-wrapper">
        <div className="container py-5">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
            <div>
              <span className="text-uppercase text-muted small fw-semibold d-block mb-1">
                Planificación logística
              </span>
              <h1 className="display-6 fw-bold text-white mb-2">
                Gestión de rutas
              </h1>
              <p className="text-muted mb-0">
                Crea recorridos, asigna supervisores y visualiza el trayecto en
                el mapa.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={openCreateModal}
            >
              Nueva ruta
            </button>
          </div>

          <section className="card admin-card shadow-sm border-0 mb-4">
            <div className="card-body">
              <form
                className="row gy-3 align-items-end"
                onSubmit={handleSearchSubmit}
              >
                <div className="col-12 col-md-6 col-xl-5">
                  <label htmlFor="route-search" className="form-label mb-1">
                    Buscar rutas
                  </label>
                  <input
                    id="route-search"
                    className="form-control admin-filter-search"
                    placeholder="Nombre o palabra clave"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                  />
                </div>
                <div className="col-12 col-md-4 col-xl-3 d-flex gap-2">
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
                <div className="col-12 col-md-2 text-md-end">
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
          </section>

          {statusMessage ? (
            <div
              className={`alert admin-alert alert-$
                statusMessage.type === "success" ? "success" : "danger"
              } rounded-4 mb-4`}
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
              const storeMap = new Map(
                route.stores.map((store) => [store.storeId, store])
              );

              return (
                <article key={route.id} className="route-card card border-0">
                  <div className="card-body p-4 p-lg-5">
                    <div className="d-flex flex-column flex-lg-row gap-4 justify-content-between align-items-lg-start">
                      <div className="flex-grow-1">
                        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                          <h2 className="h4 mb-0 text-white">{route.name}</h2>
                          <span className="badge admin-badge admin-badge-primary">
                            {formatKilometers(route.totalDistanceKm)} km
                          </span>
                          <span className="badge admin-badge admin-badge-neutral">
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
                          type="button"
                          className="btn btn-outline-light"
                          onClick={() => openEditModal(route)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
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
                                const fromStore = storeMap.get(leg.fromStoreId);
                                const toStore = storeMap.get(leg.toStoreId);
                                return (
                                  <tr
                                    key={`${leg.fromStoreId}-${leg.toStoreId}-${index}`}
                                  >
                                    <td>{index + 1}</td>
                                    <td>
                                      {fromStore?.name ?? leg.fromStoreId}
                                    </td>
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
                </article>
              );
            })}
          </div>
        </div>

        {showFormModal ? (
          <>
            <div
              className="modal fade show d-block admin-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="routeFormModalTitle"
              onMouseDown={handleModalBackdropClick}
            >
              <div
                className="modal-dialog modal-xl modal-dialog-centered admin-modal-dialog"
                role="document"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="modal-content admin-modal-content admin-card">
                  <div className="modal-header border-0">
                    <h5 className="modal-title" id="routeFormModalTitle">
                      {editingId ? "Editar ruta" : "Registrar ruta"}
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
                        <div className="col-lg-5">
                          <div className="card bg-transparent border-0">
                            <div className="card-body p-0 d-grid gap-3">
                              <div>
                                <label
                                  className="form-label"
                                  htmlFor="route-name"
                                >
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
                                  required
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
                                      {user.nombre}
                                    </option>
                                  ))}
                                </select>
                                <small className="text-muted">
                                  Puedes seleccionar múltiples responsables
                                  (Ctrl/⌘ + clic).
                                </small>
                              </div>
                              <div className="alert admin-alert alert-secondary small mb-0">
                                La asignación de colaboradores ahora se gestiona
                                desde el módulo
                                <strong> Asignación de rutas</strong>. Crea o
                                edita la ruta aquí y luego distribuye al equipo
                                en ese módulo.
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
                                  <div className="d-flex flex-column flex-lg-row gap-2">
                                    <select
                                      id="route-store-selector"
                                      className="form-select"
                                      value={selectedStoreToAdd}
                                      onChange={(event) =>
                                        setSelectedStoreToAdd(
                                          event.target.value
                                        )
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
                                      className="btn btn-outline-primary"
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
                                      <span className="badge admin-badge admin-badge-primary">
                                        {formState.storeIds.length} puntos
                                      </span>
                                    </div>
                                    {selectedStores.length > 0 ? (
                                      <div className="d-grid gap-2">
                                        {selectedStores.map((store, index) => (
                                          <div
                                            key={store.id}
                                            className="route-store-item d-flex flex-wrap flex-sm-nowrap align-items-center justify-content-between rounded-3 p-3 gap-3"
                                          >
                                            <div className="flex-grow-1">
                                              <div className="fw-semibold text-white">
                                                {index + 1}. {store.name}
                                              </div>
                                              <div className="small text-muted">
                                                #{store.storeNumber} ·{" "}
                                                {store.province ??
                                                  "Provincia desconocida"}
                                              </div>
                                            </div>
                                            <div className="d-flex flex-wrap gap-2">
                                              <button
                                                type="button"
                                                className="btn btn-sm btn-outline-light"
                                                onClick={() =>
                                                  handleMoveStore(
                                                    store.id,
                                                    "up"
                                                  )
                                                }
                                                disabled={index === 0}
                                                aria-label={`Mover ${store.name} hacia arriba`}
                                              >
                                                ↑
                                              </button>
                                              <button
                                                type="button"
                                                className="btn btn-sm btn-outline-light"
                                                onClick={() =>
                                                  handleMoveStore(
                                                    store.id,
                                                    "down"
                                                  )
                                                }
                                                disabled={
                                                  index ===
                                                  selectedStores.length - 1
                                                }
                                                aria-label={`Mover ${store.name} hacia abajo`}
                                              >
                                                ↓
                                              </button>
                                              <button
                                                type="button"
                                                className="btn btn-sm btn-outline-danger"
                                                onClick={() =>
                                                  handleRemoveStore(store.id)
                                                }
                                                aria-label={`Eliminar ${store.name} de la ruta`}
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
            <div className="modal-backdrop fade show admin-modal-backdrop" />
          </>
        ) : null}
      </main>
    </AdminGuard>
  );
}
