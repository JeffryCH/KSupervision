import { NextResponse, type NextRequest } from "next/server";
import {
  deleteRoute,
  getRouteById,
  updateRoute,
  type UpdateRouteInput,
} from "@/lib/routes";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const route = await getRouteById(id);

    if (!route) {
      return NextResponse.json(
        { success: false, message: "Ruta no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: route });
  } catch (error) {
    console.error("Error al obtener ruta:", error);
    return NextResponse.json(
      { success: false, message: "No se pudo obtener la ruta" },
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
    const { name, description, storeIds, supervisors, assignees, workPlan } =
      body ?? {};

    const updates: UpdateRouteInput = {};

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (storeIds !== undefined) updates.storeIds = storeIds;
    if (supervisors !== undefined) updates.supervisors = supervisors;
    if (assignees !== undefined) updates.assignees = assignees;
    if (workPlan !== undefined) updates.workPlan = workPlan;

    const { id } = await context.params;
    const updated = await updateRoute(id, updates);

    return NextResponse.json({
      success: true,
      message: "Ruta actualizada correctamente",
      data: updated,
    });
  } catch (error) {
    console.error("Error al actualizar ruta:", error);
    const message =
      error instanceof Error ? error.message : "No se pudo actualizar la ruta";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const deleted = await deleteRoute(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Ruta no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Ruta eliminada correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar ruta:", error);
    return NextResponse.json(
      { success: false, message: "No se pudo eliminar la ruta" },
      { status: 500 }
    );
  }
}
