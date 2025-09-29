import { NextResponse } from "next/server";
import {
  recordVisitLog,
  listVisitLogHistory,
  getLatestVisitLog,
  type VisitLogStatus,
  type VisitAnswerInput,
} from "@/lib/visitLogs";

function parseLimit(rawLimit: string | null) {
  if (!rawLimit) return 20;
  const parsed = Number.parseInt(rawLimit, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 20;
  }
  return Math.min(parsed, 100);
}

function normalizeAnswers(value: unknown): VisitAnswerInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const {
        questionId,
        value: answerValue,
        attachments,
      } = entry as {
        questionId?: unknown;
        value?: unknown;
        attachments?: unknown;
      };
      const id = typeof questionId === "string" ? questionId.trim() : "";
      if (!id) {
        return null;
      }

      const normalizedAttachments = Array.isArray(attachments)
        ? attachments
            .map((item) => (typeof item === "string" ? item : String(item)))
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
        : [];

      let normalizedValue: VisitAnswerInput["value"] = null;

      if (
        typeof answerValue === "string" ||
        typeof answerValue === "number" ||
        typeof answerValue === "boolean"
      ) {
        normalizedValue = answerValue;
      } else if (Array.isArray(answerValue)) {
        const values = answerValue
          .map((item) => (typeof item === "string" ? item : String(item)))
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
        normalizedValue = values;
      } else if (answerValue === null) {
        normalizedValue = null;
      }

      const data: VisitAnswerInput = {
        questionId: id,
        value: normalizedValue,
      };

      if (normalizedAttachments.length > 0) {
        data.attachments = normalizedAttachments;
      }

      return data;
    })
    .filter((entry): entry is VisitAnswerInput => Boolean(entry));
}

function parseStatus(rawStatus: unknown): VisitLogStatus | undefined {
  if (rawStatus === "in_progress" || rawStatus === "submitted") {
    return rawStatus;
  }
  return undefined;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const storeId = url.searchParams.get("storeId")?.trim();
    const formTemplateId = url.searchParams.get("formTemplateId")?.trim();
    const variant = url.searchParams.get("variant")?.trim();

    if (!storeId || !formTemplateId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Debes indicar la tienda y el formulario para consultar la bitácora",
        },
        { status: 400 }
      );
    }

    if (variant === "latest") {
      const latest = await getLatestVisitLog(storeId, formTemplateId);
      return NextResponse.json({ success: true, data: latest });
    }

    const limit = parseLimit(url.searchParams.get("limit"));
    const logs = await listVisitLogHistory(storeId, formTemplateId, limit);
    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error("Error al consultar bitácoras de visita:", error);
    return NextResponse.json(
      {
        success: false,
        message: "No se pudieron obtener los registros de bitácora",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      storeId,
      formTemplateId,
      routeId,
      assigneeId,
      createdBy,
      visitDate,
      status,
      answers,
    } = body ?? {};

    if (!storeId || !formTemplateId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tienda y formulario son obligatorios para registrar la bitácora",
        },
        { status: 400 }
      );
    }

    const normalizedAnswers = normalizeAnswers(answers);
    if (normalizedAnswers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Debes responder al menos una pregunta",
        },
        { status: 400 }
      );
    }

    const log = await recordVisitLog({
      storeId,
      formTemplateId,
      routeId,
      assigneeId,
      createdBy,
      visitDate,
      status: parseStatus(status) ?? "submitted",
      answers: normalizedAnswers,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Bitácora registrada correctamente",
        data: log,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error al registrar bitácora de visita:", error);
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo registrar la bitácora";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
