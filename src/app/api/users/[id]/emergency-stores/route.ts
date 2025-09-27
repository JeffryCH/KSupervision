import { NextResponse, type NextRequest } from "next/server";
import { listStoresBySupervisors } from "@/lib/stores";
import { listSupervisorIdsForMember } from "@/lib/workgroups";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "El usuario no es válido" },
        { status: 400 }
      );
    }

    const supervisorIds = await listSupervisorIdsForMember(id);

    if (supervisorIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const stores = await listStoresBySupervisors(supervisorIds);
    return NextResponse.json({ success: true, data: stores });
  } catch (error) {
    console.error(
      "Error al obtener las tiendas de emergencia para el usuario:",
      error
    );
    return NextResponse.json(
      {
        success: false,
        message: "No se pudieron obtener las tiendas disponibles",
      },
      { status: 500 }
    );
  }
}
