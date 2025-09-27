"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import { useUserSession } from "@/hooks/useUserSession";

type UserRole = "admin" | "supervisor" | "usuario";

type UserSummary = {
  id: string;
  nombre: string;
  email: string;
  role: UserRole;
};

type WorkgroupRecord = {
  supervisorId: string;
  memberIds: string[];
};

type Feedback = { type: "success" | "error"; text: string } | null;

function normalizeRole(value: unknown): UserRole {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "admin" || lower === "supervisor" || lower === "usuario") {
      return lower;
    }
  }
  return "usuario";
}

function sortByName<T extends { nombre: string }>(list: T[]) {
  return [...list].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function matchesQuery(value: string, query: string) {
  return value.toLowerCase().includes(query.toLowerCase());
}

export default function WorkgroupsPage() {
  const { user: sessionUser } = useUserSession();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [workgroups, setWorkgroups] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("");
  const [memberSearch, setMemberSearch] = useState("");
  const [availableSearch, setAvailableSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);

  const isAdmin = sessionUser?.role?.toLowerCase() === "admin";
  const sessionSupervisorId =
    !isAdmin && sessionUser?.id ? sessionUser.id : null;

  const supervisors = useMemo(() => {
    const result = users.filter((user) => user.role !== "usuario");
    return sortByName(result);
  }, [users]);

  const employees = useMemo(() => {
    const result = users.filter((user) => user.role === "usuario");
    return sortByName(result);
  }, [users]);

  const fetchData = useCallback(async (initial = false) => {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
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
          email: String((item as { email?: string }).email ?? ""),
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
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al cargar la información de grupos",
      });
    } finally {
      if (initial) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (selectedSupervisorId) {
      const stillExists = supervisors.some(
        (supervisor) => supervisor.id === selectedSupervisorId
      );
      if (!stillExists) {
        const fallback =
          (sessionSupervisorId &&
            supervisors.find(
              (supervisor) => supervisor.id === sessionSupervisorId
            )?.id) ??
          supervisors[0]?.id ??
          "";
        if (fallback !== selectedSupervisorId) {
          setSelectedSupervisorId(fallback);
        }
      }
      return;
    }

    const fallback =
      (sessionSupervisorId &&
        supervisors.find((supervisor) => supervisor.id === sessionSupervisorId)
          ?.id) ??
      supervisors.find(
        (supervisor) => (workgroups[supervisor.id]?.length ?? 0) > 0
      )?.id ??
      supervisors[0]?.id ??
      "";

    if (fallback) {
      setSelectedSupervisorId(fallback);
    }
  }, [
    loading,
    supervisors,
    selectedSupervisorId,
    sessionSupervisorId,
    workgroups,
  ]);

  useEffect(() => {
    setMemberSearch("");
    setAvailableSearch("");
  }, [selectedSupervisorId]);

  const selectedSupervisor = useMemo(
    () => supervisors.find((user) => user.id === selectedSupervisorId) ?? null,
    [selectedSupervisorId, supervisors]
  );

  const currentMemberIds = useMemo(() => {
    if (!selectedSupervisorId) {
      return [];
    }
    return workgroups[selectedSupervisorId] ?? [];
  }, [selectedSupervisorId, workgroups]);

  const currentMemberUsers = useMemo(() => {
    const mapped = currentMemberIds
      .map((memberId) => employees.find((employee) => employee.id === memberId))
      .filter((user): user is UserSummary => Boolean(user));
    return sortByName(mapped);
  }, [currentMemberIds, employees]);

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) {
      return currentMemberUsers;
    }
    return currentMemberUsers.filter(
      (member) =>
        matchesQuery(member.nombre, memberSearch) ||
        matchesQuery(member.email, memberSearch)
    );
  }, [currentMemberUsers, memberSearch]);

  const availableEmployees = useMemo(() => {
    const excluded = new Set(currentMemberIds);
    const list = employees.filter((employee) => !excluded.has(employee.id));
    return sortByName(list);
  }, [employees, currentMemberIds]);

  const filteredAvailableEmployees = useMemo(() => {
    if (!availableSearch.trim()) {
      return availableEmployees;
    }
    return availableEmployees.filter(
      (employee) =>
        matchesQuery(employee.nombre, availableSearch) ||
        matchesQuery(employee.email, availableSearch)
    );
  }, [availableEmployees, availableSearch]);

  const handleSelectSupervisor = useCallback((supervisorId: string) => {
    setSelectedSupervisorId(supervisorId);
    setFeedback(null);
  }, []);

  const updateSupervisorMembers = useCallback(
    async (
      supervisorId: string,
      nextMembers: string[],
      successMessage: string,
      pendingId?: string
    ) => {
      if (!supervisorId) {
        return;
      }

      try {
        setIsSaving(true);
        setPendingMemberId(pendingId ?? null);
        setFeedback(null);

        const response = await fetch(`/api/workgroups/${supervisorId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberIds: nextMembers }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ?? "No se pudieron guardar los cambios del equipo"
          );
        }

        setWorkgroups((prev) => ({
          ...prev,
          [supervisorId]: nextMembers,
        }));

        setFeedback({ type: "success", text: successMessage });
      } catch (error) {
        console.error(error);
        setFeedback({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "No se pudieron guardar los cambios del equipo",
        });
      } finally {
        setIsSaving(false);
        setPendingMemberId(null);
      }
    },
    []
  );

  const handleAddMember = useCallback(
    (memberId: string) => {
      if (!selectedSupervisorId || !memberId) {
        return;
      }

      const existing = workgroups[selectedSupervisorId] ?? [];
      if (existing.includes(memberId)) {
        setFeedback({
          type: "error",
          text: "El colaborador ya forma parte del equipo",
        });
        return;
      }

      const nextMembers = [...existing, memberId];
      void updateSupervisorMembers(
        selectedSupervisorId,
        nextMembers,
        "Colaborador agregado al equipo",
        memberId
      );
    },
    [selectedSupervisorId, workgroups, updateSupervisorMembers]
  );

  const handleRemoveMember = useCallback(
    (memberId: string) => {
      if (!selectedSupervisorId) {
        return;
      }

      const existing = workgroups[selectedSupervisorId] ?? [];
      const nextMembers = existing.filter((id) => id !== memberId);
      void updateSupervisorMembers(
        selectedSupervisorId,
        nextMembers,
        "Colaborador eliminado del equipo",
        memberId
      );
    },
    [selectedSupervisorId, workgroups, updateSupervisorMembers]
  );

  const handleRefresh = useCallback(() => {
    void fetchData(false);
  }, [fetchData]);

  const selectedSupervisorTeamSize = currentMemberIds.length;
  const availableCount = availableEmployees.length;

  return (
    <AdminGuard>
      <main className="container py-5">
        <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
          <div>
            <h1 className="h3 fw-bold text-white mb-1">Grupos de trabajo</h1>
            <p className="text-muted mb-0">
              Revisa y ajusta los equipos asignados a cada supervisor en tiempo
              real.
            </p>
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-light"
              onClick={handleRefresh}
              disabled={loading || refreshing}
            >
              {refreshing ? "Actualizando…" : "Refrescar"}
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

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status" />
            <p className="mt-3 text-muted">Cargando grupos…</p>
          </div>
        ) : (
          <div className="row g-4">
            {isAdmin ? (
              <aside className="col-12 col-xl-4">
                <div className="card admin-card h-100">
                  <div className="card-body d-grid gap-3">
                    <div>
                      <h2 className="h5 fw-semibold text-white mb-1">
                        Supervisores
                      </h2>
                      <p className="text-muted small mb-0">
                        Selecciona un supervisor para administrar su equipo.
                      </p>
                    </div>

                    {supervisors.length === 0 ? (
                      <div className="text-muted small">
                        Aún no hay supervisores registrados.
                      </div>
                    ) : (
                      <div className="d-grid gap-2">
                        {supervisors.map((supervisor) => {
                          const memberCount =
                            workgroups[supervisor.id]?.length ?? 0;
                          const isActive =
                            supervisor.id === selectedSupervisorId;
                          return (
                            <button
                              key={supervisor.id}
                              type="button"
                              className={`btn ${
                                isActive
                                  ? "btn-primary"
                                  : "btn-outline-light text-start"
                              } d-flex justify-content-between align-items-center`}
                              onClick={() =>
                                handleSelectSupervisor(supervisor.id)
                              }
                            >
                              <span>{supervisor.nombre}</span>
                              <span className="badge bg-dark">
                                {memberCount}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            ) : null}

            <section className={isAdmin ? "col-12 col-xl-8" : "col-12"}>
              <div className="card admin-card h-100">
                <div className="card-body d-grid gap-4">
                  {!selectedSupervisor ? (
                    <div className="text-muted text-center py-5">
                      No hay un supervisor seleccionado.
                    </div>
                  ) : (
                    <>
                      <div className="d-flex flex-wrap justify-content-between gap-3 align-items-start">
                        <div>
                          <h2 className="h4 fw-semibold text-white mb-1">
                            {selectedSupervisor.nombre}
                          </h2>
                          <p className="text-muted small mb-0">
                            {selectedSupervisorTeamSize}{" "}
                            {selectedSupervisorTeamSize === 1
                              ? "colaborador asignado"
                              : "colaboradores asignados"}
                          </p>
                        </div>
                        <div className="text-end text-muted small">
                          <div>Disponibles para agregar: {availableCount}</div>
                        </div>
                      </div>

                      <div className="row g-3">
                        <div className="col-12 col-lg-6">
                          <div className="card bg-surface-light border-0 h-100">
                            <div className="card-body d-grid gap-3">
                              <div className="d-flex justify-content-between align-items-center">
                                <h3 className="h6 text-uppercase text-muted mb-0">
                                  Equipo asignado
                                </h3>
                                <span className="badge bg-primary-subtle text-primary">
                                  {selectedSupervisorTeamSize}
                                </span>
                              </div>

                              <div className="input-group input-group-sm">
                                <span className="input-group-text">Buscar</span>
                                <input
                                  type="search"
                                  className="form-control"
                                  placeholder="Nombre o correo"
                                  value={memberSearch}
                                  onChange={(event) =>
                                    setMemberSearch(event.target.value)
                                  }
                                  disabled={isSaving && !pendingMemberId}
                                />
                              </div>

                              {filteredMembers.length === 0 ? (
                                <div className="text-center text-muted py-4">
                                  {currentMemberUsers.length === 0
                                    ? "Aún no has asignado colaboradores a este supervisor."
                                    : "Ningún colaborador coincide con la búsqueda actual."}
                                </div>
                              ) : (
                                <ul className="list-group list-group-flush">
                                  {filteredMembers.map((member) => (
                                    <li
                                      key={member.id}
                                      className="list-group-item bg-transparent text-white d-flex justify-content-between align-items-start"
                                    >
                                      <div>
                                        <div className="fw-semibold">
                                          {member.nombre}
                                        </div>
                                        {member.email ? (
                                          <div className="small text-muted">
                                            {member.email}
                                          </div>
                                        ) : null}
                                      </div>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() =>
                                          handleRemoveMember(member.id)
                                        }
                                        disabled={
                                          isSaving ||
                                          pendingMemberId === member.id
                                        }
                                      >
                                        {pendingMemberId === member.id
                                          ? "Quitando…"
                                          : "Quitar"}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="col-12 col-lg-6">
                          <div className="card bg-surface-light border-0 h-100">
                            <div className="card-body d-grid gap-3">
                              <div className="d-flex justify-content-between align-items-center">
                                <h3 className="h6 text-uppercase text-muted mb-0">
                                  Colaboradores disponibles
                                </h3>
                                <span className="badge bg-secondary-subtle text-dark">
                                  {availableCount}
                                </span>
                              </div>

                              <div className="input-group input-group-sm">
                                <span className="input-group-text">Buscar</span>
                                <input
                                  type="search"
                                  className="form-control"
                                  placeholder="Nombre o correo"
                                  value={availableSearch}
                                  onChange={(event) =>
                                    setAvailableSearch(event.target.value)
                                  }
                                  disabled={isSaving && !pendingMemberId}
                                />
                              </div>

                              {filteredAvailableEmployees.length === 0 ? (
                                <div className="text-center text-muted py-4">
                                  {availableEmployees.length === 0
                                    ? "Todos los colaboradores ya pertenecen a este equipo."
                                    : "Ningún colaborador disponible coincide con la búsqueda."}
                                </div>
                              ) : (
                                <ul className="list-group list-group-flush">
                                  {filteredAvailableEmployees.map(
                                    (employee) => (
                                      <li
                                        key={employee.id}
                                        className="list-group-item bg-transparent text-white d-flex justify-content-between align-items-start"
                                      >
                                        <div>
                                          <div className="fw-semibold">
                                            {employee.nombre}
                                          </div>
                                          {employee.email ? (
                                            <div className="small text-muted">
                                              {employee.email}
                                            </div>
                                          ) : null}
                                        </div>
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-outline-light"
                                          onClick={() =>
                                            handleAddMember(employee.id)
                                          }
                                          disabled={
                                            isSaving ||
                                            pendingMemberId === employee.id
                                          }
                                        >
                                          {pendingMemberId === employee.id
                                            ? "Agregando…"
                                            : "Agregar"}
                                        </button>
                                      </li>
                                    )
                                  )}
                                </ul>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </AdminGuard>
  );
}
