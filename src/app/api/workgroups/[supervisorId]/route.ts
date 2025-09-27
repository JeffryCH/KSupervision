import { NextResponse, type NextRequest } from "next/server";
import {
  getWorkgroupBySupervisor,
  setWorkgroupMembers,
} from "@/lib/workgroups";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ supervisorId: string }> }
) {
  try {
    const { supervisorId } = await context.params;
    const workgroup = await getWorkgroupBySupervisor(supervisorId);

    if (!workgroup) {
      return NextResponse.json({
        success: true,
        data: { supervisorId, memberIds: [] },
      });
    }

    return NextResponse.json({ success: true, data: workgroup });
  } catch (error) {
    console.error("Error al obtener grupo de trabajo:", error);
    return NextResponse.json(
      { success: false, message: "No se pudo obtener el grupo de trabajo" },
      { status: 400 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ supervisorId: string }> }
) {
  try {
    const body = await request.json();
    const { memberIds } = body ?? {};

    if (!Array.isArray(memberIds)) {
      return NextResponse.json(
        { success: false, message: "memberIds debe ser un arreglo" },
        { status: 400 }
      );
    }

    const { supervisorId } = await context.params;
    const workgroup = await setWorkgroupMembers(supervisorId, memberIds);

    return NextResponse.json({
      success: true,
      message: "Asignaciones actualizadas correctamente",
      data: workgroup,
    });
  } catch (error) {
    console.error("Error al actualizar grupo de trabajo:", error);
    const message =
      error instanceof Error ? error.message : "No se pudo actualizar el grupo";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
