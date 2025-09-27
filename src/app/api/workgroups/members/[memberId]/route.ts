import { NextResponse, type NextRequest } from "next/server";
import {
  listSupervisorIdsForMember,
  setMemberSupervisors,
} from "@/lib/workgroups";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await context.params;
    const supervisors = await listSupervisorIdsForMember(memberId);

    return NextResponse.json({ success: true, data: supervisors });
  } catch (error) {
    console.error("Error al obtener los supervisores del colaborador:", error);
    return NextResponse.json(
      {
        success: false,
        message: "No se pudieron obtener los supervisores del colaborador",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const body = await request.json();
    const { supervisorIds } = body ?? {};

    if (!Array.isArray(supervisorIds)) {
      return NextResponse.json(
        { success: false, message: "supervisorIds debe ser un arreglo" },
        { status: 400 }
      );
    }

    const { memberId } = await context.params;
    await setMemberSupervisors(memberId, supervisorIds);

    return NextResponse.json({
      success: true,
      message: "Supervisores actualizados correctamente",
    });
  } catch (error) {
    console.error("Error al actualizar supervisores del colaborador:", error);
    const message =
      error instanceof Error
        ? error.message
        : "No se pudieron actualizar los supervisores del colaborador";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
