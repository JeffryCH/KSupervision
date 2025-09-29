import { NextResponse } from "next/server";
import {
  listFormTemplates,
  type ListFormTemplatesFilters,
  type FormScopeDTO,
} from "@/lib/forms";
import { STORE_FORMAT_OPTIONS, type StoreFormat } from "@/lib/stores";

const VALID_STATUS = ["draft", "published", "archived"] as const;
const VALID_SCOPE: FormScopeDTO["kind"][] = ["all", "formats", "stores"];

function parseStatus(param: string | null) {
  if (!param) return undefined;
  const statuses = param
    .split(",")
    .map((status) => status.trim())
    .filter((status) =>
      VALID_STATUS.includes(status as (typeof VALID_STATUS)[number])
    ) as Array<(typeof VALID_STATUS)[number]>;

  return statuses.length ? statuses : undefined;
}

function parseScope(param: string | null) {
  if (!param) return undefined;
  return VALID_SCOPE.includes(param as FormScopeDTO["kind"])
    ? (param as FormScopeDTO["kind"])
    : undefined;
}

function parseFormat(param: string | null) {
  if (!param) return undefined;
  const trimmed = param.trim();
  if (!trimmed) return undefined;
  return STORE_FORMAT_OPTIONS.includes(trimmed as StoreFormat)
    ? (trimmed as StoreFormat)
    : undefined;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = parseStatus(url.searchParams.get("status"));
    const scopeKind = parseScope(url.searchParams.get("scopeKind"));
    const format = parseFormat(url.searchParams.get("format"));
    const storeIdParam = url.searchParams.get("storeId")?.trim() || undefined;

    const filters: ListFormTemplatesFilters = {};
    if (status) filters.status = status;
    if (scopeKind) filters.scopeKind = scopeKind;
    if (format) filters.format = format;
    if (storeIdParam) filters.storeId = storeIdParam;

    const templates = await listFormTemplates(filters);

    return NextResponse.json({ success: true, data: templates });
  } catch (error) {
    console.error("Error al listar formularios de bitácora:", error);
    return NextResponse.json(
      {
        success: false,
        message: "No se pudieron obtener los formularios de bitácora",
      },
      { status: 500 }
    );
  }
}
