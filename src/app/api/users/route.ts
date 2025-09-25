import { NextResponse } from "next/server";
import { createUser, listUsers, UserRole } from "@/lib/users";

function parseBoolean(value: string | null) {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim().toLowerCase();
    const role = url.searchParams.get("role") as UserRole | null;
    const activeParam = parseBoolean(url.searchParams.get("active"));

    const users = await listUsers();

    const filtered = users.filter((user) => {
      const matchesSearch = search
        ? user.cedula.includes(search) ||
          user.nombre.toLowerCase().includes(search) ||
          user.email.toLowerCase().includes(search)
        : true;

      const matchesRole = role ? user.role === role : true;
      const matchesActive =
        activeParam === undefined ? true : user.active === activeParam;

      return matchesSearch && matchesRole && matchesActive;
    });

    return NextResponse.json({ success: true, data: filtered });
  } catch (error) {
    console.error("Error al listar usuarios:", error);
    return NextResponse.json(
      { success: false, message: "No se pudieron obtener los usuarios" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cedula, nombre, email, password, role, active } = body ?? {};

    if (!cedula || !nombre || !email || !password || !role) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Cédula, nombre, correo, contraseña y rol son campos obligatorios",
        },
        { status: 400 }
      );
    }

    if (!["admin", "supervisor", "usuario"].includes(role)) {
      return NextResponse.json(
        { success: false, message: "Rol inválido" },
        { status: 400 }
      );
    }

    const user = await createUser({
      cedula,
      nombre,
      email,
      password,
      role,
      active,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Usuario creado correctamente",
        data: user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error al crear usuario:", error);
    const message =
      error instanceof Error ? error.message : "No se pudo crear el usuario";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
