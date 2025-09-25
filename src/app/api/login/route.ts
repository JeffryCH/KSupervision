import { NextResponse } from "next/server";
import { verifyCredentials } from "@/lib/users";

interface LoginRequest {
  cedula?: string;
  password?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginRequest;
    const cedula = body.cedula?.trim();
    const password = body.password?.trim();

    if (!cedula || !password) {
      return NextResponse.json(
        { success: false, message: "Cédula y contraseña son obligatorias" },
        { status: 400 }
      );
    }

    const user = await verifyCredentials(cedula, password);

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Inicio de sesión exitoso",
        user: {
          id: user.id,
          cedula: user.cedula,
          nombre: user.nombre,
          role: user.role,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al autenticar:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}
