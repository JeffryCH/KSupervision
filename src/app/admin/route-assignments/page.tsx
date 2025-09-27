"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import { useUserSession } from "@/hooks/useUserSession";

type UserRole = "admin" | "supervisor" | "usuario";

type UserSummary = {
  id: string;
  nombre: string;
  role: UserRole;
};

type RouteStore = {
  id: string;
  name: string;
  address?: string;
};

type RouteSummary = {
  id: string;
  name: string;
  description: string;
  assignees: string[];
  stores: RouteStore[];
  storeCount: number;
  updatedAt: string;
};

type WorkgroupRecord = {
  supervisorId: string;
  memberIds: string[];
};

type Feedback = { type: "success" | "error"; text: string } | null;

function normalizeRole(value: unknown): UserRole {
  if (typeof value === "string") {
    const role = value.toLowerCase();
    if (role === "admin" || role === "supervisor" || role === "usuario") {
      return role;
    }
  }
  return "usuario";
}

function sortUsers(list: UserSummary[]) {
  return [...list].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function parseStores(source: unknown): RouteStore[] {
  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((store) => {
      if (typeof store === "string") {
        return { id: store, name: store } satisfies RouteStore;
      }
      if (store && typeof store === "object") {
        const record = store as Record<string, unknown>;
        const id = String(record.id ?? record._id ?? "");
        const name = String(
          record.name ?? record.nombre ?? record.tienda ?? ""
        );
        const addressRaw =
          record.address ?? record.direccion ?? record.addressLine;
        const address =
          typeof addressRaw === "string" && addressRaw.length > 0
            ? addressRaw
            : undefined;

        if (id) {
          return {
            id,
            name: name.length > 0 ? name : `Tienda ${id.slice(-4)}`,
            address,
          } satisfies RouteStore;
        }
      }
      return null;
    })
    .filter((store): store is RouteStore => Boolean(store));
}

export default function RouteAssignmentsPage() {
  const { user: sessionUser } = useUserSession();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [workgroups, setWorkgroups] = useState<Record<string, string[]>>({});
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [routeAssignments, setRouteAssignments] = useState<
    Record<string, string[]>
  >({});
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [savingRouteId, setSavingRouteId] = useState<string | null>(null);

  const isAdmin = sessionUser?.role?.toLowerCase() === "admin";
  const sessionSupervisorId =
    sessionUser && sessionUser.role?.toLowerCase() !== "admin"
      ? sessionUser.id
      : null;

  const supervisors = useMemo(() => {
    const list = users.filter((user) => user.role !== "usuario");
    return sortUsers(list);
  }, [users]);

  const employees = useMemo(() => {
    const list = users.filter((user) => user.role === "usuario");
    return sortUsers(list);
  }, [users]);

  const fetchUsersAndWorkgroups = useCallback(async () => {
    try {
      setLoadingUsers(true);
      setFeedback(null);

      const [usersResponse, workgroupsResponse] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/workgroups"),
      ]);

      const usersData = await usersResponse.json();
      const workgroupsData = await workgroupsResponse.json();

      if (!usersResponse.ok || !usersData.success) {
        throw new Error(
          usersData.message ?? "No se pudieron obtener los usuarios"
        );
      }

      if (!workgroupsResponse.ok || !workgroupsData.success) {
        throw new Error(
          workgroupsData.message ??
            "No se pudieron obtener los grupos de trabajo"
        );
      }

      const parsedUsers: UserSummary[] = (
        Array.isArray(usersData.data) ? (usersData.data as unknown[]) : []
      )
        .filter(
          (item: unknown): item is Record<string, unknown> =>
            Boolean(item) && typeof item === "object"
        )
        .map((item: Record<string, unknown>) => ({
          id: String(item.id ?? ""),
          nombre: String(item.nombre ?? ""),
          role: normalizeRole((item as { role?: string }).role),
        }))
        .filter(
          (user: UserSummary) => user.id.length > 0 && Boolean(user.nombre)
        );

      setUsers(parsedUsers);

      const grouped: Record<string, string[]> = {};
      (Array.isArray(workgroupsData.data)
        ? (workgroupsData.data as WorkgroupRecord[])
        : []
      )
        .filter(
          (record): record is WorkgroupRecord =>
            Boolean(record) &&
            typeof record.supervisorId === "string" &&
            Array.isArray(record.memberIds)
        )
        .forEach((record) => {
          grouped[record.supervisorId] = record.memberIds.filter(
            (memberId): memberId is string => typeof memberId === "string"
          );
        });

      setWorkgroups(grouped);

      setSelectedSupervisorId((previous) => {
        if (previous) {
          return previous;
        }

        if (!isAdmin) {
          if (sessionSupervisorId) {
            return sessionSupervisorId;
          }
          const firstSupervisor = parsedUsers.find(
            (user) => user.role !== "usuario"
          );
          return firstSupervisor?.id ?? "";
        }

        return sessionSupervisorId ?? "all";
      });
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al cargar los datos iniciales",
      });
    } finally {
      setLoadingUsers(false);
    }
  }, [isAdmin, sessionSupervisorId]);

  useEffect(() => {
    void fetchUsersAndWorkgroups();
  }, [fetchUsersAndWorkgroups]);

  const canEditAssignments = useMemo(() => {
    if (!selectedSupervisorId) {
      return false;
    }
    if (!isAdmin) {
      return true;
    }
    return selectedSupervisorId !== "all";
  }, [isAdmin, selectedSupervisorId]);

  const teamMemberIds = useMemo(() => {
    if (!canEditAssignments) {
      return [] as string[];
    }
    return workgroups[selectedSupervisorId] ?? [];
  }, [canEditAssignments, selectedSupervisorId, workgroups]);

  const teamUsers = useMemo(() => {
    if (!teamMemberIds.length) {
      return [] as UserSummary[];
    }
    const set = new Set(teamMemberIds);
    return employees.filter((employee) => set.has(employee.id));
  }, [employees, teamMemberIds]);

  const selectedSupervisorUser = useMemo(() => {
    if (!canEditAssignments) {
      return null;
    }
    return supervisors.find((user) => user.id === selectedSupervisorId) ?? null;
  }, [canEditAssignments, selectedSupervisorId, supervisors]);

  const assignableUserCount = useMemo(() => {
    if (!canEditAssignments) {
      return 0;
    }
    const unique = new Set<string>();
    teamUsers.forEach((user) => unique.add(user.id));
    if (selectedSupervisorUser) {
      unique.add(selectedSupervisorUser.id);
    }
    return unique.size;
  }, [canEditAssignments, selectedSupervisorUser, teamUsers]);

  const fetchRoutes = useCallback(async (supervisorId: string) => {
    try {
      setLoadingRoutes(true);
      setFeedback(null);

      const query =
        !supervisorId || supervisorId === "all"
          ? ""
          : `?supervisorId=${encodeURIComponent(supervisorId)}`;
      const response = await fetch(`/api/routes${query}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "No se pudieron obtener las rutas");
      }

      const parsedRoutes: RouteSummary[] = (
        Array.isArray(data.data) ? (data.data as unknown[]) : []
      )
        .filter(
          (route: unknown): route is Record<string, unknown> =>
            Boolean(route) && typeof route === "object"
        )
        .map((route: Record<string, unknown>) => {
          const stores = parseStores((route as { stores?: unknown }).stores);
          const assignees = Array.isArray(
            (route as { assignees?: unknown }).assignees
          )
            ? ((route as { assignees?: string[] }).assignees ?? []).filter(
                (assigneeId): assigneeId is string =>
                  typeof assigneeId === "string"
              )
            : [];

          return {
            id: String(route.id ?? ""),
            name: String(route.name ?? ""),
            description: String(route.description ?? ""),
            assignees,
            stores,
            storeCount: stores.length,
            updatedAt: String(route.updatedAt ?? ""),
          } satisfies RouteSummary;
        })
        .filter(
          (route: RouteSummary) => route.id.length > 0 && route.name.length > 0
        );

      const sortedRoutes = [...parsedRoutes].sort((a, b) =>
        a.name.localeCompare(b.name, "es")
      );

      setRoutes(sortedRoutes);
      const assignments: Record<string, string[]> = {};
      sortedRoutes.forEach((route) => {
        assignments[route.id] = route.assignees;
      });
      setRouteAssignments(assignments);
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al cargar las rutas",
      });
    } finally {
      setLoadingRoutes(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedSupervisorId && !isAdmin) {
      return;
    }
    void fetchRoutes(selectedSupervisorId);
  }, [fetchRoutes, isAdmin, selectedSupervisorId]);

  const handleToggleAssignment = useCallback(
    (routeId: string, userId: string) => {
      setRouteAssignments((previous) => {
        const current = new Set(previous[routeId] ?? []);
        if (current.has(userId)) {
          current.delete(userId);
        } else {
          current.add(userId);
        }
        return {
          ...previous,
          [routeId]: Array.from(current),
        };
      });
    },
    []
  );

  const handleSaveRoute = useCallback(
    async (routeId: string) => {
      const assignees = routeAssignments[routeId] ?? [];
      try {
        setSavingRouteId(routeId);
        setFeedback(null);
        const response = await fetch(`/api/routes/${routeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignees }),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message ?? "No se pudo guardar la asignación");
        }

        setFeedback({
          type: "success",
          text: "Asignación de ruta actualizada",
        });
      } catch (error) {
        console.error(error);
        setFeedback({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "No se pudo actualizar la asignación de la ruta",
        });
      } finally {
        setSavingRouteId(null);
      }
    },
    [routeAssignments]
  );

  const handleSupervisorChange = useCallback((value: string) => {
    setSelectedSupervisorId(value);
    setFeedback(null);
  }, []);

  const handleRefreshRoutes = useCallback(() => {
    void fetchRoutes(selectedSupervisorId);
  }, [fetchRoutes, selectedSupervisorId]);

  const assigneeOptions = useMemo(() => {
    if (!canEditAssignments) {
      return [] as UserSummary[];
    }
    const map = new Map<string, UserSummary>();
    teamUsers.forEach((member) => map.set(member.id, member));
    if (selectedSupervisorUser) {
      map.set(selectedSupervisorUser.id, selectedSupervisorUser);
    }
    return sortUsers(Array.from(map.values()));
  }, [canEditAssignments, selectedSupervisorUser, teamUsers]);

  const routeStats = useMemo(() => {
    if (!isAdmin) {
      return null;
    }
    const totalRoutes = routes.length;
    const totalStores = routes.reduce(
      (acc, route) => acc + route.storeCount,
      0
    );
    const assignedRoutes = routes.filter(
      (route) => route.assignees.length > 0
    ).length;
    const uniqueAssignees = new Set<string>();
    routes.forEach((route) => {
      route.assignees.forEach((id) => uniqueAssignees.add(id));
    });

    return {
      totalRoutes,
      assignedRoutes,
      unassignedRoutes: totalRoutes - assignedRoutes,
      totalStores,
      uniqueAssignees: uniqueAssignees.size,
    };
  }, [isAdmin, routes]);

  return (
    <AdminGuard>
      <main className="container py-5">
        <header className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
          <div>
            <h1 className="h3 fw-bold text-white mb-1">Asignación de rutas</h1>
            <p className="text-muted mb-0">
              Visualiza las rutas, sus tiendas asignadas y administra qué
              colaboradores las ejecutan.
            </p>
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-light"
              onClick={handleRefreshRoutes}
              disabled={loadingRoutes}
            >
              {loadingRoutes ? "Actualizando…" : "Refrescar"}
            </button>
          </div>
        </header>

        {feedback ? (
          <div
            className={`alert alert-${
              feedback.type === "success" ? "success" : "danger"
            } rounded-4`}
          >
            {feedback.text}
          </div>
        ) : null}

        {routeStats ? (
          <section className="row g-3 mb-4">
            <div className="col-12 col-md-3">
              <div className="card admin-card h-100">
                <div className="card-body">
                  <div className="text-muted text-uppercase small mb-1">
                    Rutas totales
                  </div>
                  <div className="display-6 fw-bold text-white">
                    {routeStats.totalRoutes}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-3">
              <div className="card admin-card h-100">
                <div className="card-body">
                  <div className="text-muted text-uppercase small mb-1">
                    Rutas con asignación
                  </div>
                  <div className="display-6 fw-bold text-success">
                    {routeStats.assignedRoutes}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-3">
              <div className="card admin-card h-100">
                <div className="card-body">
                  <div className="text-muted text-uppercase small mb-1">
                    Rutas sin asignar
                  </div>
                  <div className="display-6 fw-bold text-warning">
                    {routeStats.unassignedRoutes}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-3">
              <div className="card admin-card h-100">
                <div className="card-body">
                  <div className="text-muted text-uppercase small mb-1">
                    Tiendas cubiertas
                  </div>
                  <div className="display-6 fw-bold text-info">
                    {routeStats.totalStores}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="card admin-card mb-4">
          <div className="card-body d-grid gap-3">
            <div className="row g-3 align-items-end">
              <div className="col-12 col-md-6">
                <label htmlFor="route-supervisor" className="form-label mb-1">
                  {isAdmin ? "Supervisores" : "Tu supervisión"}
                </label>
                {isAdmin ? (
                  <select
                    id="route-supervisor"
                    className="form-select"
                    value={selectedSupervisorId}
                    onChange={(event) =>
                      handleSupervisorChange(event.target.value)
                    }
                    disabled={loadingUsers}
                  >
                    <option value="all">Ver todas las rutas</option>
                    {supervisors.map((supervisor) => (
                      <option key={supervisor.id} value={supervisor.id}>
                        {supervisor.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="route-supervisor"
                    type="text"
                    className="form-control"
                    value={
                      supervisors.find(
                        (supervisor) => supervisor.id === selectedSupervisorId
                      )?.nombre ?? ""
                    }
                    disabled
                  />
                )}
              </div>
              <div className="col-12 col-md-6">
                {canEditAssignments ? (
                  <div className="small text-muted">
                    {assignableUserCount > 0
                      ? `${assignableUserCount} colaborador(es) disponibles para asignar esta ruta.`
                      : "Aún no hay colaboradores asignados a este supervisor. Configura el equipo desde Grupos de trabajo."}
                  </div>
                ) : (
                  <div className="small text-muted">
                    Selecciona un supervisor para gestionar sus rutas y
                    asignaciones.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {loadingRoutes ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status" />
            <p className="mt-3 text-muted">Cargando rutas…</p>
          </div>
        ) : routes.length === 0 ? (
          <div className="text-center text-muted py-5">
            <p className="mb-2">No se encontraron rutas para este filtro.</p>
            <p className="mb-0">
              Verifica la configuración o agrega nuevas rutas desde la gestión
              correspondiente.
            </p>
          </div>
        ) : (
          <div className="d-grid gap-4">
            {routes.map((route) => {
              const assignment = routeAssignments[route.id] ?? [];
              const includedUsers = new Map<string, UserSummary>();
              assigneeOptions.forEach((user) =>
                includedUsers.set(user.id, user)
              );
              assignment.forEach((userId) => {
                const matchedUser = users.find((user) => user.id === userId);
                if (matchedUser) {
                  includedUsers.set(matchedUser.id, matchedUser);
                }
              });
              const checkboxOptions = sortUsers(
                Array.from(includedUsers.values())
              );

              return (
                <article key={route.id} className="card admin-card">
                  <div className="card-body d-grid gap-4">
                    <div className="d-flex flex-wrap justify-content-between gap-3 align-items-start">
                      <div>
                        <h2 className="h5 fw-semibold text-white mb-1">
                          {route.name}
                        </h2>
                        <p className="text-muted small mb-0">
                          {route.description || "Sin descripción"}
                        </p>
                      </div>
                      <div className="text-end text-muted small">
                        <div>{route.storeCount} tienda(s) en la ruta</div>
                        <div>
                          Actualizada el{" "}
                          {route.updatedAt
                            ? new Date(route.updatedAt).toLocaleString("es-CR")
                            : "N/D"}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="h6 text-uppercase text-muted mb-2">
                        Tiendas asignadas
                      </h3>
                      {route.stores.length === 0 ? (
                        <div className="text-muted small">
                          Esta ruta aún no tiene tiendas enlazadas.
                        </div>
                      ) : (
                        <div className="d-flex flex-wrap gap-2">
                          {route.stores.map((store) => (
                            <span
                              key={store.id}
                              className="badge bg-primary-subtle text-primary"
                            >
                              {store.name}
                              {store.address ? (
                                <span className="ms-1 text-muted">
                                  • {store.address}
                                </span>
                              ) : null}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="h6 text-uppercase text-muted mb-2">
                        Equipo asignado
                      </h3>
                      {!canEditAssignments ? (
                        <div className="text-muted small">
                          Selecciona un supervisor para gestionar las
                          asignaciones de esta ruta.
                        </div>
                      ) : checkboxOptions.length === 0 ? (
                        <div className="text-muted small">
                          No hay colaboradores disponibles para asignar.
                        </div>
                      ) : (
                        <ul className="list-group list-group-flush">
                          {checkboxOptions.map((user) => {
                            const checked = assignment.includes(user.id);
                            return (
                              <li
                                key={user.id}
                                className="list-group-item bg-transparent d-flex justify-content-between align-items-center gap-3"
                              >
                                <div>
                                  <div className="fw-semibold text-white">
                                    {user.nombre}
                                  </div>
                                  <div className="text-muted small text-capitalize">
                                    {user.role}
                                  </div>
                                </div>
                                <div className="form-check form-switch mb-0">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    id={`route-${route.id}-user-${user.id}`}
                                    checked={checked}
                                    onChange={() =>
                                      handleToggleAssignment(route.id, user.id)
                                    }
                                    aria-label={`Asignar ${user.nombre} a ${route.name}`}
                                    disabled={savingRouteId === route.id}
                                  />
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div className="d-flex justify-content-end">
                      <button
                        type="button"
                        className="btn btn-outline-light"
                        onClick={() => void handleSaveRoute(route.id)}
                        disabled={
                          !canEditAssignments ||
                          savingRouteId === route.id ||
                          (assigneeOptions.length === 0 &&
                            assignment.length === 0)
                        }
                      >
                        {savingRouteId === route.id
                          ? "Guardando…"
                          : "Guardar asignación"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </AdminGuard>
  );
}
