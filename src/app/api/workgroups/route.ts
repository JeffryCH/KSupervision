import { NextResponse } from "next/server";
import { listWorkgroups } from "@/lib/workgroups";

export async function GET() {
  try {
    const workgroups = await listWorkgroups();
    return NextResponse.json({ success: true, data: workgroups });
  } catch (error) {
    console.error("Error al listar grupos de trabajo:", error);
    return NextResponse.json(
      {
        success: false,
        message: "No se pudieron obtener los grupos de trabajo",
      },
      { status: 500 }
    );
  }
}
