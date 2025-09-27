"use client";

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

type UserRole = "admin" | "supervisor" | "usuario";

type User = {
  id: string;
  cedula: string;
  nombre: string;
  email: string;
  phone: string | null;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type StatusMessage = {
  type: "success" | "error";
  text: string;
};

interface UserFormState {
  cedula: string;
  nombre: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  active: boolean;
}

const emptyFormState: UserFormState = {
  cedula: "",
  nombre: "",
  email: "",
  phone: "",
  password: "",
  role: "usuario",
  active: true,
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [formState, setFormState] = useState<UserFormState>(emptyFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null
  );
  const [showFormModal, setShowFormModal] = useState(false);
  const [formAlert, setFormAlert] = useState<{
    type: "error" | "warning";
    text: string;
  } | null>(null);
  const cedulaInputRef = useRef<HTMLInputElement | null>(null);

  const hasUsers = users.length > 0;

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = query
        ? user.cedula.includes(query) ||
          user.nombre.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          (user.phone ? user.phone.includes(query) : false)
        : true;
      const matchesRole = roleFilter ? user.role === roleFilter : true;
      const matchesActive =
        activeFilter === ""
          ? true
          : activeFilter === "true"
          ? user.active
          : !user.active;

      return matchesSearch && matchesRole && matchesActive;
    });
  }, [users, search, roleFilter, activeFilter]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      if (activeFilter) params.set("active", activeFilter);

      const query = params.toString();
      const response = await fetch(
        query ? `/api/users?${query}` : "/api/users"
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "No se pudieron obtener los usuarios");
      }

      setUsers(data.data ?? []);
    } catch (error) {
      console.error(error);
      setStatusMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al cargar los usuarios",
      });
    } finally {
      setLoading(false);
    }
  }, [activeFilter, roleFilter, search]);

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

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showFormModal]);

  useEffect(() => {
    if (showFormModal && cedulaInputRef.current) {
      cedulaInputRef.current.focus();
    }
  }, [showFormModal]);

  function closeFormModal() {
    setShowFormModal(false);
    setFormState(emptyFormState);
    setEditingId(null);
    setSubmitting(false);
    setFormAlert(null);
  }

  function openCreateModal() {
    setFormState(emptyFormState);
    setEditingId(null);
    setShowFormModal(true);
    setFormAlert(null);
  }

  function openEditModal(user: User) {
    setFormState({
      cedula: user.cedula,
      nombre: user.nombre,
      email: user.email,
      phone: user.phone ?? "",
      password: "",
      role: user.role,
      active: user.active,
    });
    setEditingId(user.id);
    setShowFormModal(true);
    setFormAlert(null);
  }

  function handleModalBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      closeFormModal();
    }
  }

  async function handleDelete(user: User) {
    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar al usuario ${user.nombre} (${user.cedula})?`
    );
    if (!confirmed) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "No se pudo eliminar el usuario");
      }

      setStatusMessage({
        type: "success",
        text: "Usuario eliminado correctamente",
      });
      await fetchUsers();
    } catch (error) {
      console.error(error);
      setStatusMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al eliminar el usuario",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormAlert(null);

    if (!formState.cedula || !formState.nombre) {
      setFormAlert({ type: "error", text: "Cédula y nombre son obligatorios" });
      return;
    }

    if (
      formState.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(formState.email)
    ) {
      setFormAlert({
        type: "error",
        text: "El correo electrónico no es válido",
      });
      return;
    }

    if (formState.password && formState.password.length < 6) {
      setFormAlert({
        type: "error",
        text: "La contraseña debe tener al menos 6 caracteres",
      });
      return;
    }

    const payload: Record<string, unknown> = {
      cedula: formState.cedula,
      nombre: formState.nombre,
      role: formState.role,
      active: formState.active,
    };

    const trimmedEmail = formState.email.trim();
    if (trimmedEmail) {
      payload.email = trimmedEmail;
    } else if (editingId) {
      payload.email = "";
    }

    const cleanedPhone = formState.phone.replace(/[\s()-]/g, "");
    if (cleanedPhone) {
      payload.phone = cleanedPhone;
    } else if (editingId) {
      payload.phone = "";
    }

    if (formState.password) {
      payload.password = formState.password;
    }

    try {
      setSubmitting(true);
      const response = await fetch(
        editingId ? `/api/users/${editingId}` : "/api/users",
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
              ? "No se pudo actualizar el usuario"
              : "No se pudo crear el usuario")
        );
      }

      setStatusMessage({
        type: "success",
        text: editingId
          ? "Usuario actualizado correctamente"
          : "Usuario creado correctamente",
      });

      closeFormModal();
      await fetchUsers();
    } catch (error) {
      console.error(error);
      setFormAlert({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al guardar el usuario",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminGuard>
      <main className="admin-users-wrapper">
        <div className="container py-5">
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
            <div>
              <h1 className="display-6 fw-bold text-white mb-2">
                Administración de usuarios
              </h1>
              <p className="text-muted mb-0">
                Crea, edita y gestiona las cuentas que podrán acceder al
                sistema.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={openCreateModal}
            >
              Nuevo usuario
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
                    <h2 className="h4 mb-1">Listado de usuarios</h2>
                    <p className="text-muted mb-0">
                      {loading
                        ? "Cargando usuarios..."
                        : hasUsers
                        ? `${filteredUsers.length} resultado(s)`
                        : "No hay usuarios registrados"}
                    </p>
                  </div>

                  <div className="d-flex flex-wrap gap-2">
                    <input
                      type="search"
                      className="form-control admin-filter-search"
                      placeholder="Buscar por nombre, cédula, correo o teléfono"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void fetchUsers();
                        }
                      }}
                    />
                    <select
                      className="form-select"
                      value={roleFilter}
                      onChange={(event) =>
                        setRoleFilter(event.target.value as UserRole | "")
                      }
                      aria-label="Filtrar por rol"
                    >
                      <option value="">Todos los roles</option>
                      <option value="admin">Administradores</option>
                      <option value="supervisor">Supervisores</option>
                      <option value="usuario">Usuarios</option>
                    </select>
                    <select
                      className="form-select"
                      value={activeFilter}
                      onChange={(event) =>
                        setActiveFilter(
                          event.target.value as "" | "true" | "false"
                        )
                      }
                      aria-label="Filtrar por estado"
                    >
                      <option value="">Todos</option>
                      <option value="true">Activos</option>
                      <option value="false">Inactivos</option>
                    </select>
                    <button
                      type="button"
                      className="btn btn-outline-light"
                      onClick={() => void fetchUsers()}
                    >
                      Aplicar filtros
                    </button>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-dark table-hover align-middle mb-0">
                    <thead>
                      <tr>
                        <th scope="col">Cédula</th>
                        <th scope="col">Nombre</th>
                        <th scope="col">Correo</th>
                        <th scope="col">Teléfono</th>
                        <th scope="col">Rol</th>
                        <th scope="col" className="text-center">
                          Estado
                        </th>
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

                      {!loading && filteredUsers.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="text-center py-4 text-muted"
                          >
                            No se encontraron usuarios con los filtros
                            seleccionados.
                          </td>
                        </tr>
                      )}

                      {!loading &&
                        filteredUsers.map((user) => (
                          <tr key={user.id}>
                            <td>{user.cedula}</td>
                            <td>{user.nombre}</td>
                            <td>{user.email}</td>
                            <td>{user.phone ?? "-"}</td>
                            <td className="text-capitalize">{user.role}</td>
                            <td className="text-center">
                              <span
                                className={`badge rounded-pill ${
                                  user.active ? "bg-success" : "bg-secondary"
                                }`}
                              >
                                {user.active ? "Activo" : "Inactivo"}
                              </span>
                            </td>
                            <td className="text-end">
                              <div className="btn-group" role="group">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-light"
                                  onClick={() => openEditModal(user)}
                                  disabled={submitting}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => void handleDelete(user)}
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
                aria-labelledby="userFormModalTitle"
                onClick={handleModalBackdropClick}
              >
                <div
                  className="modal-dialog modal-lg modal-dialog-centered admin-modal-dialog"
                  role="document"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="modal-content admin-modal-content admin-card">
                    <div className="modal-header">
                      <h5 className="modal-title" id="userFormModalTitle">
                        {editingId ? "Editar usuario" : "Crear nuevo usuario"}
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
                        {formAlert && (
                          <div
                            className={`alert alert-${
                              formAlert.type === "error" ? "danger" : "warning"
                            }`}
                            role="alert"
                          >
                            {formAlert.text}
                          </div>
                        )}
                        <div className="row g-3">
                          <div className="col-md-6">
                            <label htmlFor="cedula" className="form-label">
                              Cédula
                            </label>
                            <input
                              id="cedula"
                              name="cedula"
                              className="form-control"
                              inputMode="numeric"
                              maxLength={12}
                              value={formState.cedula}
                              ref={cedulaInputRef}
                              onChange={(event) =>
                                setFormState((prev) => ({
                                  ...prev,
                                  cedula: event.target.value.replace(
                                    /[^\d]/g,
                                    ""
                                  ),
                                }))
                              }
                              required
                            />
                          </div>

                          <div className="col-md-6">
                            <label htmlFor="nombre" className="form-label">
                              Nombre completo
                            </label>
                            <input
                              id="nombre"
                              name="nombre"
                              className="form-control"
                              value={formState.nombre}
                              onChange={(event) =>
                                setFormState((prev) => ({
                                  ...prev,
                                  nombre: event.target.value,
                                }))
                              }
                              required
                            />
                          </div>

                          <div className="col-md-6">
                            <label htmlFor="email" className="form-label">
                              Correo electrónico
                            </label>
                            <input
                              id="email"
                              type="email"
                              className="form-control"
                              value={formState.email}
                              onChange={(event) =>
                                setFormState((prev) => ({
                                  ...prev,
                                  email: event.target.value,
                                }))
                              }
                            />
                          </div>

                          <div className="col-md-6">
                            <label htmlFor="phone" className="form-label">
                              Número de teléfono
                            </label>
                            <input
                              id="phone"
                              type="tel"
                              className="form-control"
                              value={formState.phone}
                              onChange={(event) =>
                                setFormState((prev) => ({
                                  ...prev,
                                  phone: event.target.value,
                                }))
                              }
                              placeholder="Ej: +593987654321"
                            />
                          </div>

                          <div className="col-md-6">
                            <label htmlFor="role" className="form-label">
                              Rol
                            </label>
                            <select
                              id="role"
                              className="form-select"
                              value={formState.role}
                              onChange={(event) =>
                                setFormState((prev) => ({
                                  ...prev,
                                  role: event.target.value as UserRole,
                                }))
                              }
                            >
                              <option value="admin">Administrador</option>
                              <option value="supervisor">Supervisor</option>
                              <option value="usuario">Usuario</option>
                            </select>
                          </div>

                          <div className="col-md-6">
                            <label htmlFor="password" className="form-label">
                              {editingId ? "Nueva contraseña" : "Contraseña"}
                            </label>
                            <input
                              id="password"
                              type="password"
                              className="form-control"
                              value={formState.password}
                              onChange={(event) =>
                                setFormState((prev) => ({
                                  ...prev,
                                  password: event.target.value,
                                }))
                              }
                              placeholder={
                                editingId
                                  ? "Déjalo vacío para mantener la actual"
                                  : "Ingresa una contraseña segura"
                              }
                              minLength={6}
                            />
                          </div>

                          <div className="col-md-6 d-flex align-items-center">
                            <div className="form-check form-switch mt-4">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="active"
                                checked={formState.active}
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    active: event.target.checked,
                                  }))
                                }
                              />
                              <label
                                className="form-check-label"
                                htmlFor="active"
                              >
                                Usuario activo
                              </label>
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
                            ? "Actualizar usuario"
                            : "Crear usuario"}
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
    </AdminGuard>
  );
}
