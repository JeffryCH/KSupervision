import { NextResponse } from "next/server";
import {
  createFormTemplate,
  listFormTemplates,
  type CreateFormTemplateInput,
  type ListFormTemplatesFilters,
  type FormScopeDTO,
} from "@/lib/forms";
import { STORE_FORMAT_OPTIONS, type StoreFormat } from "@/lib/stores";

const VALID_STATUS = ["draft", "published", "archived"] as const;
const VALID_SCOPE_KIND: FormScopeDTO["kind"][] = ["all", "formats", "stores"];

type QuestionPayload = CreateFormTemplateInput["questions"][number];
type QuestionOption = NonNullable<QuestionPayload["options"]>[number];

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

function parseScopeKind(param: string | null) {
  if (!param) return undefined;
  return VALID_SCOPE_KIND.includes(param as FormScopeDTO["kind"])
    ? (param as FormScopeDTO["kind"])
    : undefined;
}
function normalizeScopePayload(
  scope: unknown
): CreateFormTemplateInput["scope"] | null {
  if (!scope || typeof scope !== "object") {
    return null;
  }

  const { kind } = scope as { kind?: unknown };
  if (kind === "all") {
    return { kind: "all" };
  }

  if (kind === "formats") {
    const formatsRaw = Array.isArray((scope as { formats?: unknown }).formats)
      ? ((scope as { formats?: unknown }).formats as unknown[])
      : [];
    const formats = Array.from(
      new Set(
        formatsRaw
          .map((format) => (typeof format === "string" ? format.trim() : ""))
          .filter((format): format is StoreFormat =>
            STORE_FORMAT_OPTIONS.includes(format as StoreFormat)
          )
      )
    );

    if (formats.length === 0) {
      return null;
    }

    return { kind: "formats", formats };
  }

  if (kind === "stores") {
    const storeIdsRaw = Array.isArray(
      (scope as { storeIds?: unknown }).storeIds
    )
      ? ((scope as { storeIds?: unknown }).storeIds as unknown[])
      : [];
    const storeIds = Array.from(
      new Set(
        storeIdsRaw
          .map((storeId) => (typeof storeId === "string" ? storeId.trim() : ""))
          .filter((storeId): storeId is string => Boolean(storeId))
      )
    );

    if (storeIds.length === 0) {
      return null;
    }

    return { kind: "stores", storeIds };
  }

  return null;
}

function parseFormat(param: string | null) {
  if (!param) return undefined;
  const trimmed = param.trim();
  if (!trimmed) return undefined;
  return STORE_FORMAT_OPTIONS.includes(trimmed as StoreFormat)
    ? (trimmed as StoreFormat)
    : undefined;
}

function normalizeQuestionPayload(payload: unknown): QuestionPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const { id, type, title, description, required, order, options, compliance } =
    payload as Record<string, unknown>;

  if (typeof type !== "string" || typeof title !== "string") {
    return null;
  }

  const normalizedOptions = Array.isArray(options)
    ? options.reduce<QuestionOption[]>((acc, option) => {
        if (!option || typeof option !== "object") {
          return acc;
        }

        const { value, label } = option as Record<string, unknown>;
        if (typeof value !== "string") {
          return acc;
        }

        const optionValue: QuestionOption = {
          value,
          ...(typeof label === "string" ? { label } : {}),
        };

        acc.push(optionValue);
        return acc;
      }, [])
    : undefined;

  const normalized: QuestionPayload = {
    id: typeof id === "string" ? id : undefined,
    type: type as QuestionPayload["type"],
    title,
    description: typeof description === "string" ? description : undefined,
    required: typeof required === "boolean" ? required : undefined,
    order: Number.isFinite(order) ? Number(order) : undefined,
    options: normalizedOptions,
    compliance:
      compliance && typeof compliance === "object"
        ? {
            weight: Number.isFinite(
              (compliance as Record<string, unknown>).weight
            )
              ? Number((compliance as Record<string, unknown>).weight)
              : undefined,
            expectedValue: (compliance as Record<string, unknown>)
              .expectedValue as
              | string
              | string[]
              | number
              | boolean
              | undefined,
            min: Number.isFinite((compliance as Record<string, unknown>).min)
              ? Number((compliance as Record<string, unknown>).min)
              : undefined,
            max: Number.isFinite((compliance as Record<string, unknown>).max)
              ? Number((compliance as Record<string, unknown>).max)
              : undefined,
            minPhotos: Number.isFinite(
              (compliance as Record<string, unknown>).minPhotos
            )
              ? Number((compliance as Record<string, unknown>).minPhotos)
              : undefined,
            maxPhotos: Number.isFinite(
              (compliance as Record<string, unknown>).maxPhotos
            )
              ? Number((compliance as Record<string, unknown>).maxPhotos)
              : undefined,
            allowPartial:
              typeof (compliance as Record<string, unknown>).allowPartial ===
              "boolean"
                ? Boolean((compliance as Record<string, unknown>).allowPartial)
                : undefined,
          }
        : undefined,
  };

  return normalized;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = parseStatus(url.searchParams.get("status"));
    const scopeKind = parseScopeKind(url.searchParams.get("scopeKind"));
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CreateFormTemplateInput>;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, message: "El cuerpo de la solicitud es inválido" },
        { status: 400 }
      );
    }

    const name = typeof body.name === "string" ? body.name : "";
    const description =
      typeof body.description === "string" ? body.description : undefined;
    const createdBy =
      typeof body.createdBy === "string" ? body.createdBy : undefined;

    const scope = normalizeScopePayload(body.scope ?? { kind: "all" });
    if (!scope) {
      return NextResponse.json(
        {
          success: false,
          message: "Debes especificar el alcance del formulario",
        },
        { status: 400 }
      );
    }

    const questions = Array.isArray(body.questions)
      ? body.questions
          .map((question) => normalizeQuestionPayload(question))
          .filter((question): question is QuestionPayload => Boolean(question))
      : [];

    const input: CreateFormTemplateInput = {
      name,
      description,
      createdBy,
      scope,
      questions,
    };

    const template = await createFormTemplate(input);
    return NextResponse.json(
      { success: true, data: template },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error al crear formulario de bitácora:", error);
    const message =
      error instanceof Error ? error.message : "No se pudo crear el formulario";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
