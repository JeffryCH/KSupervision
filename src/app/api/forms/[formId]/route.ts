import { NextRequest, NextResponse } from "next/server";
import {
  archiveFormTemplate,
  deleteFormTemplate,
  getFormTemplateById,
  publishFormTemplate,
  updateFormTemplate,
  type CreateFormTemplateInput,
  type UpdateFormTemplateInput,
} from "@/lib/forms";
import { STORE_FORMAT_OPTIONS, type StoreFormat } from "@/lib/stores";

const VALID_STATUS = ["draft", "published", "archived"] as const;

type QuestionPayload = CreateFormTemplateInput["questions"][number];
type QuestionOption = NonNullable<QuestionPayload["options"]>[number];

type ActionPayload =
  | {
      action: "publish";
      scope?: unknown;
      updatedBy?: string;
    }
  | {
      action: "archive";
      updatedBy?: string;
    };

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

type RouteContext = { params: Promise<{ formId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { formId } = await context.params;
    const template = await getFormTemplateById(formId);
    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se encontró el formulario";
    return NextResponse.json({ success: false, message }, { status: 404 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { formId } = await context.params;
    const body = (await request.json()) as Partial<UpdateFormTemplateInput>;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, message: "El cuerpo de la solicitud es inválido" },
        { status: 400 }
      );
    }

    const payload: UpdateFormTemplateInput = {};

    if (typeof body.name === "string") {
      payload.name = body.name;
    }

    if (typeof body.description === "string") {
      payload.description = body.description;
    }

    if (typeof body.updatedBy === "string") {
      payload.updatedBy = body.updatedBy;
    }

    if (body.scope !== undefined) {
      const scope = normalizeScopePayload(body.scope);
      if (!scope) {
        return NextResponse.json(
          {
            success: false,
            message: "El alcance proporcionado no es válido",
          },
          { status: 400 }
        );
      }
      payload.scope = scope;
    }

    if (Array.isArray(body.questions)) {
      const questions = body.questions
        .map((question) => normalizeQuestionPayload(question))
        .filter((question): question is QuestionPayload => Boolean(question));

      if (questions.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Debes proporcionar al menos una pregunta para actualizar el formulario",
          },
          { status: 400 }
        );
      }

      payload.questions = questions;
    }

    if (body.status) {
      if (!VALID_STATUS.includes(body.status)) {
        return NextResponse.json(
          { success: false, message: "El estado especificado no es válido" },
          { status: 400 }
        );
      }
      payload.status = body.status;
    }

    const template = await updateFormTemplate(formId, payload);
    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error("Error al actualizar el formulario de bitácora:", error);
    const message =
      error instanceof Error ? error.message : "No se pudo actualizar";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { formId } = await context.params;
    const body = (await request.json()) as ActionPayload | null;
    if (!body || typeof body !== "object" || !("action" in body)) {
      return NextResponse.json(
        {
          success: false,
          message: "Debes especificar una acción a ejecutar",
        },
        { status: 400 }
      );
    }

    if (body.action === "publish") {
      let scope: CreateFormTemplateInput["scope"] | undefined;
      if (body.scope !== undefined) {
        const parsedScope = normalizeScopePayload(body.scope);
        if (!parsedScope) {
          return NextResponse.json(
            {
              success: false,
              message: "El alcance proporcionado no es válido",
            },
            { status: 400 }
          );
        }
        scope = parsedScope;
      }

      const template = await publishFormTemplate(formId, {
        scope,
        updatedBy: body.updatedBy,
      });
      return NextResponse.json({ success: true, data: template });
    }

    if (body.action === "archive") {
      const template = await archiveFormTemplate(formId, {
        updatedBy: body.updatedBy,
      });
      return NextResponse.json({ success: true, data: template });
    }

    return NextResponse.json(
      {
        success: false,
        message: "La acción solicitada no está soportada",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error al ejecutar acción sobre formulario:", error);
    const message =
      error instanceof Error ? error.message : "La acción no pudo completarse";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { formId } = await context.params;
    const deleted = await deleteFormTemplate(formId);
    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          message: "No se pudo eliminar el formulario especificado",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al eliminar formulario de bitácora:", error);
    const message =
      error instanceof Error ? error.message : "No se pudo eliminar";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
