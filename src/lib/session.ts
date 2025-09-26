export type SessionUser = {
  id: string;
  nombre: string;
  role: "admin" | "supervisor" | "usuario" | string;
};

const STORAGE_KEY = "appk:user-session";
const SESSION_EVENT = "appk:user-session-changed";

function parseUser(value: string | null): SessionUser | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as SessionUser;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.nombre === "string"
    ) {
      return parsed;
    }
    return null;
  } catch (error) {
    console.warn("No se pudo analizar la sesión almacenada", error);
    return null;
  }
}

export function loadSessionUser(): SessionUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  return parseUser(window.localStorage.getItem(STORAGE_KEY));
}

function emitSessionEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function saveSessionUser(user: SessionUser) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  emitSessionEvent();
}

export function clearSessionUser() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  emitSessionEvent();
}

export { STORAGE_KEY as SESSION_STORAGE_KEY, SESSION_EVENT };
