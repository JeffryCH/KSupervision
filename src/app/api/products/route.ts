import { NextResponse } from "next/server";
import {
  createProduct,
  listProducts,
  ProductListFilters,
} from "@/lib/products";

function parseFilters(url: URL): ProductListFilters {
  const search = url.searchParams.get("search")?.trim();
  const filters: ProductListFilters = {};

  if (search) {
    filters.search = search;
  }

  return filters;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filters = parseFilters(url);
    const products = await listProducts(filters);

    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    console.error("Error al listar productos:", error);
    return NextResponse.json(
      { success: false, message: "No se pudieron obtener los productos" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, factoryBarcode, upcCode } = body ?? {};

    if (!name || !factoryBarcode || !upcCode) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Nombre, código de barras de fábrica y código UPC son obligatorios",
        },
        { status: 400 }
      );
    }

    const product = await createProduct({
      name,
      factoryBarcode,
      upcCode,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Producto creado correctamente",
        data: product,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error al crear producto:", error);
    const message =
      error instanceof Error ? error.message : "No se pudo crear el producto";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
