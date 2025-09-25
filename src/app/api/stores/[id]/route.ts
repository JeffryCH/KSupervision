import { NextResponse, type NextRequest } from "next/server";
import {
  deleteStore,
  getStoreById,
  updateStore,
  UpdateStoreInput,
} from "@/lib/stores";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const store = await getStoreById(id);
    if (!store) {
      return NextResponse.json(
        { success: false, message: "Tienda no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: store });
  } catch (error) {
    console.error("Error al obtener tienda:", error);
    return NextResponse.json(
      { success: false, message: "No se pudo obtener la tienda" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const payload: UpdateStoreInput = {};

    if (name !== undefined) payload.name = name;
    if (storeNumber !== undefined) payload.storeNumber = storeNumber;
    if (format !== undefined) payload.format = format;
    if (province !== undefined) payload.province = province;
    if (canton !== undefined) payload.canton = canton;
    if (supervisors !== undefined) payload.supervisors = supervisors;
    if (latitude !== undefined) payload.latitude = Number(latitude);
    if (longitude !== undefined) payload.longitude = Number(longitude);
    if (address !== undefined) payload.address = address;
    if (placeId !== undefined) payload.placeId = placeId;

    const { id } = await context.params;
    const updated = await updateStore(id, payload);

    return NextResponse.json({
      success: true,
      message: "Tienda actualizada correctamente",
      data: updated,
    });
  } catch (error) {
    console.error("Error al actualizar tienda:", error);
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo actualizar la tienda";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const deleted = await deleteStore(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Tienda no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Tienda eliminada correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar tienda:", error);
    return NextResponse.json(
      { success: false, message: "No se pudo eliminar la tienda" },
      { status: 500 }
    );
  }
}
