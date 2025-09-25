import { NextResponse } from "next/server";
import {
  deleteProduct,
  getProductById,
  updateProduct,
  UpdateProductInput,
} from "@/lib/products";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const product = await getProductById(params.id);
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
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, factoryBarcode, upcCode } = body ?? {};

    const payload: UpdateProductInput = {};

    if (name !== undefined) payload.name = name;
    if (factoryBarcode !== undefined) payload.factoryBarcode = factoryBarcode;
    if (upcCode !== undefined) payload.upcCode = upcCode;

    const updated = await updateProduct(params.id, payload);

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
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = await deleteProduct(params.id);
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
