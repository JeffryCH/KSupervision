import { NextResponse, type NextRequest } from "next/server";
import {
  deleteProduct,
  getProductById,
  getProductDocumentById,
  updateProduct,
  type ProductImagePayload,
  type UpdateProductInput,
} from "@/lib/products";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const product = await getProductById(id);
    if (!product) {
      return NextResponse.json(
        { success: false, message: "Producto no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    console.error("Error al obtener producto:", error);
    return NextResponse.json(
      { success: false, message: "No se pudo obtener el producto" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let uploadedImage: ProductImagePayload | null = null;

  try {
    const { id } = await context.params;
    const existing = await getProductDocumentById(id);

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Producto no encontrado" },
        { status: 404 }
      );
    }

    const contentType = request.headers.get("content-type") ?? "";

    let name: string | undefined;
    let factoryBarcode: string | undefined;
    let upcCode: string | undefined;
    let removeImage = false;
    let imageFile: File | null = null;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      name = body?.name;
      factoryBarcode = body?.factoryBarcode;
      upcCode = body?.upcCode;
      removeImage = Boolean(body?.removeImage);
    } else {
      const formData = await request.formData();
      const getString = (entry: FormDataEntryValue | null) =>
        typeof entry === "string" ? entry : entry ? String(entry) : undefined;

      name = getString(formData.get("name"));
      factoryBarcode = getString(formData.get("factoryBarcode"));
      upcCode = getString(formData.get("upcCode"));
      removeImage = getString(formData.get("removeImage")) === "true";

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
        removeImage = false;
      }
    }

    if (imageFile) {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      uploadedImage = {
        data: buffer.toString("base64"),
        mimeType: imageFile.type || "application/octet-stream",
      };
    }

    const payload: UpdateProductInput = {};

    if (name !== undefined) payload.name = name;
    if (factoryBarcode !== undefined) payload.factoryBarcode = factoryBarcode;
    if (upcCode !== undefined) payload.upcCode = upcCode;
    if (uploadedImage) {
      payload.image = uploadedImage;
    } else if (removeImage) {
      payload.removeImage = true;
    }

    const updated = await updateProduct(id, payload);

    return NextResponse.json({
      success: true,
      message: "Producto actualizado correctamente",
      data: updated,
    });
  } catch (error) {
    console.error("Error al actualizar producto:", error);
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo actualizar el producto";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const existing = await getProductDocumentById(id);

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Producto no encontrado" },
        { status: 404 }
      );
    }

    const deleted = await deleteProduct(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Producto no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Producto eliminado correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    return NextResponse.json(
      { success: false, message: "No se pudo eliminar el producto" },
      { status: 500 }
    );
  }
}
