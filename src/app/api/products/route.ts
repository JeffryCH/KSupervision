import { NextResponse } from "next/server";
import {
  createProduct,
  listProducts,
  ProductListFilters,
  type ProductImagePayload,
} from "@/lib/products";
import { deleteProductImage, uploadProductImage } from "@/lib/r2";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

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
  let uploadedImage: ProductImagePayload | null = null;

  try {
    const contentType = request.headers.get("content-type") ?? "";

    let name: string | undefined;
    let factoryBarcode: string | undefined;
    let upcCode: string | undefined;
    let imageFile: File | null = null;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      name = body?.name;
      factoryBarcode = body?.factoryBarcode;
      upcCode = body?.upcCode;
    } else {
      const formData = await request.formData();
      const getString = (field: FormDataEntryValue | null) =>
        typeof field === "string" ? field : field ? String(field) : "";

      name = getString(formData.get("name"));
      factoryBarcode = getString(formData.get("factoryBarcode"));
      upcCode = getString(formData.get("upcCode"));

      const file = formData.get("image");
      if (file instanceof File && file.size > 0) {
        if (!file.type || !file.type.startsWith("image/")) {
          return NextResponse.json(
            {
              success: false,
              message: "El archivo seleccionado debe ser una imagen válida",
            },
            { status: 400 }
          );
        }

        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          return NextResponse.json(
            {
              success: false,
              message: "La imagen supera el tamaño máximo permitido (5 MB)",
            },
            { status: 400 }
          );
        }

        imageFile = file;
      }
    }

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

    if (imageFile) {
      uploadedImage = await uploadProductImage(imageFile);
    }

    const product = await createProduct({
      name,
      factoryBarcode,
      upcCode,
      image: uploadedImage ?? undefined,
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
    if (uploadedImage) {
      await deleteProductImage(uploadedImage.key);
    }
    const message =
      error instanceof Error ? error.message : "No se pudo crear el producto";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
