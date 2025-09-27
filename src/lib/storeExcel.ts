import ExcelJS from "exceljs";
import type { StoreDTO, StoreFormat } from "./stores";
import { STORE_FORMAT_OPTIONS, normalizeStoreNameKey } from "./stores";

export type StoreColumnKey =
  | "name"
  | "storeNumber"
  | "format"
  | "province"
  | "canton"
  | "supervisors"
  | "latitude"
  | "longitude"
  | "address"
  | "placeId"
  | "createdAt"
  | "updatedAt";

export interface StoreColumnDefinition {
  key: StoreColumnKey;
  header: string;
  width?: number;
  getter: (store: StoreDTO) => string | number | null;
}

export const STORE_COLUMN_DEFINITIONS: Record<
  StoreColumnKey,
  StoreColumnDefinition
> = {
  name: {
    key: "name",
    header: "Nombre tienda",
    width: 32,
    getter: (store) => store.name,
  },
  storeNumber: {
    key: "storeNumber",
    header: "Número tienda",
    width: 18,
    getter: (store) => store.storeNumber,
  },
  format: {
    key: "format",
    header: "Formato",
    width: 18,
    getter: (store) => store.format,
  },
  province: {
    key: "province",
    header: "Provincia",
    width: 22,
    getter: (store) => store.province,
  },
  canton: {
    key: "canton",
    header: "Zona/Cantón",
    width: 22,
    getter: (store) => store.canton,
  },
  supervisors: {
    key: "supervisors",
    header: "Supervisores",
    width: 36,
    getter: (store) =>
      store.supervisors?.length ? store.supervisors.join(", ") : null,
  },
  latitude: {
    key: "latitude",
    header: "Latitud",
    width: 16,
    getter: (store) =>
      typeof store.location?.latitude === "number"
        ? Number(store.location.latitude.toFixed(6))
        : null,
  },
  longitude: {
    key: "longitude",
    header: "Longitud",
    width: 16,
    getter: (store) =>
      typeof store.location?.longitude === "number"
        ? Number(store.location.longitude.toFixed(6))
        : null,
  },
  address: {
    key: "address",
    header: "Dirección",
    width: 48,
    getter: (store) => store.location?.address ?? null,
  },
  placeId: {
    key: "placeId",
    header: "Place ID",
    width: 36,
    getter: (store) => store.location?.placeId ?? null,
  },
  createdAt: {
    key: "createdAt",
    header: "Creado",
    width: 22,
    getter: (store) => store.createdAt,
  },
  updatedAt: {
    key: "updatedAt",
    header: "Actualizado",
    width: 22,
    getter: (store) => store.updatedAt,
  },
};

const COLUMN_HEADER_ALIASES: Record<StoreColumnKey, string[]> = {
  name: ["nombre", "nombretienda", "tienda"],
  storeNumber: [
    "numerotienda",
    "tiendanumero",
    "codigotienda",
    "storeid",
    "numerodetienda",
  ],
  format: ["formato"],
  province: ["provincia"],
  canton: ["zonacanton", "canton", "zona", "cantón"],
  supervisors: ["supervisores", "supervision", "supervisor"],
  latitude: ["latitud", "latitude"],
  longitude: ["longitud", "longitude"],
  address: ["direccion", "dirección", "address"],
  placeId: ["placeid", "googleplace", "googleid"],
  createdAt: ["creado", "createdat", "fechacreacion"],
  updatedAt: ["actualizado", "updatedat", "fechaactualizacion"],
};

const REQUIRED_IMPORT_COLUMNS: StoreColumnKey[] = [
  "name",
  "format",
  "province",
  "canton",
];

export interface StoreExcelRowData {
  rowNumber: number;
  name: string;
  storeNumber?: string;
  format: StoreFormat;
  province: string;
  canton: string;
  supervisors?: string[];
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  placeId?: string;
  raw: Partial<Record<StoreColumnKey, unknown>>;
}

export interface StoreExcelParseError {
  rowNumber?: number;
  message: string;
}

export interface StoreExcelParseResult {
  rows: StoreExcelRowData[];
  providedColumns: StoreColumnKey[];
  errors: StoreExcelParseError[];
  warnings: StoreExcelParseError[];
}

const DEFAULT_EXPORT_COLUMNS: StoreColumnKey[] = [
  "name",
  "storeNumber",
  "format",
  "province",
  "canton",
  "supervisors",
  "latitude",
  "longitude",
  "address",
  "placeId",
  "createdAt",
  "updatedAt",
];

function normalizeHeaderText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function sanitizeString(value: string | null | undefined) {
  return (value ?? "").toString().trim();
}

function matchColumnKey(header: string): StoreColumnKey | null {
  const normalized = normalizeHeaderText(header);
  if (!normalized) {
    return null;
  }

  for (const [key, aliases] of Object.entries(COLUMN_HEADER_ALIASES) as [
    StoreColumnKey,
    string[]
  ][]) {
    if (aliases.some((alias) => normalizeHeaderText(alias) === normalized)) {
      return key;
    }
  }

  return null;
}

function resolveFormat(value: string): StoreFormat | null {
  const normalized = sanitizeString(value).toLowerCase();
  if (!normalized) {
    return null;
  }

  const match = STORE_FORMAT_OPTIONS.find(
    (option) => option.toLowerCase() === normalized
  );

  return match ?? null;
}

function parseSupervisors(value: string): string[] {
  const cleaned = sanitizeString(value);
  if (!cleaned) {
    return [];
  }

  return cleaned
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function getCellText(cell: ExcelJS.Cell) {
  if (typeof cell.text === "string" && cell.text.trim().length > 0) {
    return cell.text.trim();
  }

  const value = cell.value;

  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "text" in (value as unknown as Record<string, unknown>)
  ) {
    const container = value as { text?: unknown };
    if (typeof container.text === "string") {
      return container.text.trim();
    }
  }

  if (typeof value === "object" && value !== null) {
    const container = value as { result?: unknown };
    if ("result" in container) {
      if (container.result === null || container.result === undefined) {
        return "";
      }
      return String(container.result).trim();
    }
  }

  return String(value).trim();
}

export async function buildStoreWorkbook(
  stores: StoreDTO[],
  keys: StoreColumnKey[] = DEFAULT_EXPORT_COLUMNS
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KSupervision";
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet("Tiendas", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const columns = keys.map((key) => {
    const definition = STORE_COLUMN_DEFINITIONS[key];
    return {
      header: definition.header,
      key: definition.key,
      width: definition.width,
    };
  });

  worksheet.columns = columns;

  stores.forEach((store) => {
    const row: Record<string, string | number | null> = {};
    keys.forEach((key) => {
      const value = STORE_COLUMN_DEFINITIONS[key].getter(store);
      row[key] = value === undefined ? null : value;
    });
    worksheet.addRow(row);
  });

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle" };

  worksheet.autoFilter = {
    from: {
      row: 1,
      column: 1,
    },
    to: {
      row: 1,
      column: keys.length,
    },
  };

  return workbook;
}

export async function buildStoreWorkbookBuffer(
  stores: StoreDTO[],
  keys: StoreColumnKey[] = DEFAULT_EXPORT_COLUMNS
) {
  const workbook = await buildStoreWorkbook(stores, keys);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function parseStoreExcel(
  fileBuffer: ArrayBuffer | Buffer
): Promise<StoreExcelParseResult> {
  const workbook = new ExcelJS.Workbook();
  type WorkbookXlsxLoadInput = Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];

  const binaryBuffer = Buffer.isBuffer(fileBuffer)
    ? fileBuffer
    : Buffer.from(fileBuffer as ArrayBuffer);

  await workbook.xlsx.load(binaryBuffer as unknown as WorkbookXlsxLoadInput);

  const worksheet =
    workbook.getWorksheet("Tiendas") ?? workbook.worksheets[0] ?? null;

  if (!worksheet) {
    return {
      rows: [],
      providedColumns: [],
      errors: [
        {
          message:
            "El archivo no contiene hojas válidas. Asegúrate de usar el formato suministrado por el sistema.",
        },
      ],
      warnings: [],
    };
  }

  const headerRow = worksheet.getRow(1);
  if (!headerRow || headerRow.cellCount === 0) {
    return {
      rows: [],
      providedColumns: [],
      errors: [
        {
          message:
            "El archivo no contiene encabezados en la primera fila. Agrega la fila de títulos e inténtalo nuevamente.",
        },
      ],
      warnings: [],
    };
  }

  const columnMap = new Map<number, StoreColumnKey>();
  const providedColumns = new Set<StoreColumnKey>();
  const warnings: StoreExcelParseError[] = [];

  headerRow.eachCell((cell, colNumber) => {
    const header = getCellText(cell);
    if (!header) {
      return;
    }

    const key = matchColumnKey(header);
    if (key) {
      columnMap.set(colNumber, key);
      providedColumns.add(key);
    } else {
      warnings.push({
        rowNumber: 1,
        message: `Columna desconocida ignorada: "${header}"`,
      });
    }
  });

  const missingRequired = REQUIRED_IMPORT_COLUMNS.filter(
    (key) => !providedColumns.has(key)
  );

  if (missingRequired.length > 0) {
    return {
      rows: [],
      providedColumns: Array.from(providedColumns),
      errors: [
        {
          message: `Faltan columnas obligatorias: ${missingRequired
            .map((key) => STORE_COLUMN_DEFINITIONS[key].header)
            .join(", ")}.
Asegúrate de incluirlas en el archivo antes de continuar.`,
        },
      ],
      warnings,
    };
  }

  const errors: StoreExcelParseError[] = [];
  const rows: StoreExcelRowData[] = [];
  const seenNames = new Map<string, number>();

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const raw: Partial<Record<StoreColumnKey, unknown>> = {};
    let hasData = false;

    columnMap.forEach((key, columnNumber) => {
      const cell = row.getCell(columnNumber);
      const text = getCellText(cell);
      if (text !== "") {
        hasData = true;
      }

      switch (key) {
        case "latitude": {
          if (!text) {
            raw[key] = null;
          } else {
            const numeric = Number(text.replace(/,/g, "."));
            if (Number.isNaN(numeric)) {
              errors.push({
                rowNumber,
                message: `La latitud en la columna ${columnNumber} no es un número válido`,
              });
              raw[key] = null;
            } else {
              raw[key] = numeric;
            }
          }
          break;
        }
        case "longitude": {
          if (!text) {
            raw[key] = null;
          } else {
            const numeric = Number(text.replace(/,/g, "."));
            if (Number.isNaN(numeric)) {
              errors.push({
                rowNumber,
                message: `La longitud en la columna ${columnNumber} no es un número válido`,
              });
              raw[key] = null;
            } else {
              raw[key] = numeric;
            }
          }
          break;
        }
        case "supervisors": {
          raw[key] = parseSupervisors(text);
          break;
        }
        default: {
          raw[key] = text || null;
          break;
        }
      }
    });

    if (!hasData) {
      return;
    }

    const name = sanitizeString((raw.name as string) ?? "");
    if (!name) {
      errors.push({
        rowNumber,
        message: "La columna 'Nombre tienda' es obligatoria y está vacía.",
      });
      return;
    }

    const nameKey = normalizeStoreNameKey(name);
    const existingRow = seenNames.get(nameKey);
    if (existingRow) {
      errors.push({
        rowNumber,
        message: `La tienda "${name}" aparece más de una vez en el archivo (fila ${existingRow}).`,
      });
      return;
    }
    seenNames.set(nameKey, rowNumber);

    const formatValue = sanitizeString((raw.format as string) ?? "");
    const storeFormat = resolveFormat(formatValue);
    if (!storeFormat) {
      errors.push({
        rowNumber,
        message: `El formato "${formatValue}" no es válido. Usa uno de: ${STORE_FORMAT_OPTIONS.join(
          ", "
        )}.`,
      });
      return;
    }

    const province = sanitizeString((raw.province as string) ?? "");
    if (!province) {
      errors.push({
        rowNumber,
        message: "La columna 'Provincia' es obligatoria y está vacía.",
      });
      return;
    }

    const canton = sanitizeString((raw.canton as string) ?? "");
    if (!canton) {
      errors.push({
        rowNumber,
        message: "La columna 'Zona/Cantón' es obligatoria y está vacía.",
      });
      return;
    }

    const supervisors =
      Array.isArray(raw.supervisors) && raw.supervisors.length > 0
        ? (raw.supervisors as string[])
        : [];

    rows.push({
      rowNumber,
      name,
      storeNumber:
        sanitizeString((raw.storeNumber as string) ?? "") || undefined,
      format: storeFormat,
      province,
      canton,
      supervisors,
      latitude: (raw.latitude as number | null | undefined) ?? null,
      longitude: (raw.longitude as number | null | undefined) ?? null,
      address: sanitizeString((raw.address as string) ?? "") || undefined,
      placeId: sanitizeString((raw.placeId as string) ?? "") || undefined,
      raw,
    });
  });

  return {
    rows,
    providedColumns: Array.from(providedColumns),
    errors,
    warnings,
  };
}
