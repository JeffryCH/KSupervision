import { NextResponse } from "next/server";
import { createRoute, listRoutes } from "@/lib/routes";

function parseFilters(url: URL) {
  const search = url.searchParams.get("search")?.trim();
  return search ? { search } : {};
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filters = parseFilters(url);
    const routes = await listRoutes(filters);

    return NextResponse.json({ success: true, data: routes });
  } catch (error) {
    console.error("Error al listar rutas:", error);
    return NextResponse.json(
      { success: false, message: "No se pudieron obtener las rutas" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, storeIds, supervisors, assignees } = body ?? {};

    if (!name || !Array.isArray(storeIds) || storeIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Nombre y la lista de tiendas son obligatorios",
        },
        { status: 400 }
      );
    }

    const route = await createRoute({
      name,
      description,
      storeIds,
      supervisors,
      assignees,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Ruta creada correctamente",
        data: route,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error al crear ruta:", error);
    const message =
      error instanceof Error ? error.message : "No se pudo crear la ruta";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
