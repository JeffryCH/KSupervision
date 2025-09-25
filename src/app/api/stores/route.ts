import { NextResponse } from "next/server";
import {
  createStore,
  listStores,
  StoreFormat,
  StoreListFilters,
} from "@/lib/stores";

function parseFilters(url: URL): StoreListFilters {
  const search = url.searchParams.get("search")?.trim();
  const formatParam = url.searchParams.get("format") as StoreFormat | null;
  const province = url.searchParams.get("province")?.trim();

  const filters: StoreListFilters = {};

  if (search) {
    filters.search = search;
  }

  if (
    formatParam &&
    ["Walmart", "Mas x Menos", "Pali", "Maxi Pali"].includes(formatParam)
  ) {
    filters.format = formatParam;
  }

  if (province) {
    filters.province = province;
  }

  return filters;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filters = parseFilters(url);
    const stores = await listStores(filters);

    return NextResponse.json({ success: true, data: stores });
  } catch (error) {
    console.error("Error al listar tiendas:", error);
    return NextResponse.json(
      { success: false, message: "No se pudieron obtener las tiendas" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      storeNumber,
      format,
      province,
      canton,
      supervisors,
      latitude,
      longitude,
      address,
      placeId,
    } = body ?? {};

    if (
      !name ||
      !storeNumber ||
      !format ||
      !province ||
      !canton ||
      typeof latitude !== "number" ||
      typeof longitude !== "number"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Nombre, número, formato, provincia, cantón y coordenadas son obligatorios",
        },
        { status: 400 }
      );
    }

    const store = await createStore({
      name,
      storeNumber,
      format,
      province,
      canton,
      supervisors,
      latitude,
      longitude,
      address,
      placeId,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Tienda creada correctamente",
        data: store,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error al crear tienda:", error);
    const message =
      error instanceof Error ? error.message : "No se pudo crear la tienda";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
