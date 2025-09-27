import { NextResponse, type NextRequest } from "next/server";
import { deleteUser, getUserById, updateUser, UserRole } from "@/lib/users";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getUserById(id);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    return NextResponse.json(
      { success: false, message: "No se pudo obtener el usuario" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { cedula, nombre, email, phone, password, role, active } = body ?? {};

    if (role && !["admin", "supervisor", "usuario"].includes(role)) {
      return NextResponse.json(
        { success: false, message: "Rol inválido" },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const updated = await updateUser(id, {
      cedula,
      nombre,
      email,
      phone,
      password,
      role: role as UserRole | undefined,
      active,
    });

    return NextResponse.json({
      success: true,
      message: "Usuario actualizado correctamente",
      data: updated,
    });
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo actualizar el usuario";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const deleted = await deleteUser(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Usuario eliminado correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    return NextResponse.json(
      { success: false, message: "No se pudo eliminar el usuario" },
      { status: 500 }
    );
  }
}
