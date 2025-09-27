import { NextResponse } from "next/server";
import {
  createStore,
  listStores,
  normalizeStoreNameKey,
  updateStore,
} from "@/lib/stores";
import { parseStoreExcel } from "@/lib/storeExcel";
import { createStoreBackup } from "@/lib/storeBackups";

interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
}

function extractFileName(file: Blob) {
  if (typeof (file as File).name === "string") {
    return (file as File).name;
  }
  return undefined;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof Blob)) {
      return NextResponse.json(
        {
          success: false,
          message: "Debes adjuntar un archivo Excel en el campo 'file'",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const parseResult = await parseStoreExcel(arrayBuffer);

    if (parseResult.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "El archivo contiene errores. Corrige y vuelve a intentar.",
          data: {
            errors: parseResult.errors,
            warnings: parseResult.warnings,
          },
        },
        { status: 400 }
      );
    }

    if (parseResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "El archivo no contiene filas de tiendas para importar",
          data: {
            warnings: parseResult.warnings,
          },
        },
        { status: 400 }
      );
    }

    const existingStores = await listStores();

    await createStoreBackup(existingStores, {
      reason: "Importación masiva desde Excel",
      sourceFilename: extractFileName(file),
      columns: parseResult.providedColumns,
    });

    const existingByName = new Map(
      existingStores.map((store) => [normalizeStoreNameKey(store.name), store])
    );

    const existingByNumber = new Map(
      existingStores.map((store) => [store.storeNumber.toLowerCase(), store])
    );

    const summary: ImportSummary = {
      created: 0,
      updated: 0,
      skipped: 0,
    };

    const warnings = [...parseResult.warnings];

    for (const row of parseResult.rows) {
      const latitude = row.latitude ?? null;
      const longitude = row.longitude ?? null;

      if ((latitude === null) !== (longitude === null)) {
        warnings.push({
          rowNumber: row.rowNumber,
          message:
            "Para importar coordenadas debes incluir latitud y longitud juntas. La fila se omitió.",
        });
        summary.skipped += 1;
        continue;
      }

      if (latitude !== null && (latitude < -90 || latitude > 90)) {
        warnings.push({
          rowNumber: row.rowNumber,
          message: "La latitud está fuera del rango permitido (-90 a 90).",
        });
        summary.skipped += 1;
        continue;
      }

      if (longitude !== null && (longitude < -180 || longitude > 180)) {
        warnings.push({
          rowNumber: row.rowNumber,
          message: "La longitud está fuera del rango permitido (-180 a 180).",
        });
        summary.skipped += 1;
        continue;
      }

      const nameKey = normalizeStoreNameKey(row.name);
      let existing = existingByName.get(nameKey);

      if (!existing && row.storeNumber) {
        const numberKey = row.storeNumber.trim().toLowerCase();
        existing = existingByNumber.get(numberKey) ?? existing;
      }

      const supervisors =
        row.supervisors && row.supervisors.length > 0 ? row.supervisors : [];

      try {
        if (existing) {
          const previousNameKey = normalizeStoreNameKey(existing.name);
          const previousNumberKey = existing.storeNumber.toLowerCase();

          const updated = await updateStore(existing.id, {
            name: row.name,
            storeNumber: row.storeNumber ?? existing.storeNumber,
            format: row.format,
            province: row.province,
            canton: row.canton,
            supervisors,
            latitude,
            longitude,
            address: row.address,
            placeId: row.placeId,
          });

          existingByName.delete(previousNameKey);
          existingByNumber.delete(previousNumberKey);

          existingByName.set(normalizeStoreNameKey(updated.name), updated);
          existingByNumber.set(updated.storeNumber.toLowerCase(), updated);

          summary.updated += 1;
        } else {
          const created = await createStore({
            name: row.name,
            storeNumber: row.storeNumber ?? "",
            format: row.format,
            province: row.province,
            canton: row.canton,
            supervisors,
            latitude,
            longitude,
            address: row.address,
            placeId: row.placeId,
          });

          existingByName.set(normalizeStoreNameKey(created.name), created);
          existingByNumber.set(created.storeNumber.toLowerCase(), created);

          summary.created += 1;
        }
      } catch (error) {
        console.error(`No se pudo procesar la fila ${row.rowNumber}:`, error);
        warnings.push({
          rowNumber: row.rowNumber,
          message:
            error instanceof Error
              ? error.message
              : "No se pudo procesar la fila por un error inesperado.",
        });
        summary.skipped += 1;
      }
    }

    const message =
      parseResult.rows.length === summary.skipped
        ? "No se aplicaron cambios. Revisa las advertencias del proceso."
        : `Importación completada: ${summary.created} nuevas, ${summary.updated} actualizadas, ${summary.skipped} omitidas.`;

    return NextResponse.json({
      success: true,
      message,
      data: {
        summary,
        warnings,
      },
    });
  } catch (error) {
    console.error("Error al importar tiendas desde Excel:", error);
    return NextResponse.json(
      {
        success: false,
        message: "No se pudo importar el archivo de tiendas",
      },
      { status: 500 }
    );
  }
}
