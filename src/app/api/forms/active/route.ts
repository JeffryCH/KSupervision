import { NextResponse } from "next/server";
import { resolveActiveFormForStore } from "@/lib/visitLogs";
import type { StoreFormat } from "@/lib/stores";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const storeId = url.searchParams.get("storeId")?.trim();
    const formatParam = url.searchParams.get("format")?.trim();

    if (!storeId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Debes especificar la tienda para obtener la bitácora activa",
        },
        { status: 400 }
      );
    }

    const storeFormat = formatParam ? (formatParam as StoreFormat) : undefined;
    const template = await resolveActiveFormForStore(storeId, storeFormat);

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error("Error al resolver la bitácora activa:", error);
    return NextResponse.json(
      {
        success: false,
        message: "No se pudo obtener la bitácora activa",
      },
      { status: 500 }
    );
  }
}
