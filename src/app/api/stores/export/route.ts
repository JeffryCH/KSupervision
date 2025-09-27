import { NextResponse } from "next/server";
import { listStores } from "@/lib/stores";
import {
  STORE_COLUMN_DEFINITIONS,
  StoreColumnKey,
  buildStoreWorkbookBuffer,
} from "@/lib/storeExcel";

function parseColumnParams(url: URL) {
  const rawValues = [
    ...url.searchParams.getAll("column"),
    ...url.searchParams.getAll("columns"),
  ];

  if (rawValues.length === 0) {
    return {
      columns: undefined as StoreColumnKey[] | undefined,
      invalid: [] as string[],
    };
  }

  const validKeys = new Set<StoreColumnKey>();
  const invalid: string[] = [];

  rawValues
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .forEach((value) => {
      if (value in STORE_COLUMN_DEFINITIONS) {
        validKeys.add(value as StoreColumnKey);
      } else {
        invalid.push(value);
      }
    });

  return {
    columns: validKeys.size > 0 ? Array.from(validKeys) : undefined,
    invalid,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { columns, invalid } = parseColumnParams(url);

    if (invalid.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Columnas no válidas solicitadas: ${invalid.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const stores = await listStores();
    const buffer = await buildStoreWorkbookBuffer(stores, columns);

    const today = new Date().toISOString().split("T")[0];
    const filename = `tiendas-${today}.xlsx`;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Error al exportar tiendas:", error);
    return NextResponse.json(
      {
        success: false,
        message: "No se pudo generar el archivo de tiendas",
      },
      { status: 500 }
    );
  }
}
