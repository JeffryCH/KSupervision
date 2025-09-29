import { ObjectId, WithId } from "mongodb";
import { getVisitLogsCollection } from "./mongodb";
import {
  findActiveFormTemplateForStore,
  getFormTemplateById,
  type FormQuestionDTO,
  type FormTemplateDTO,
} from "./forms";
import type { StoreFormat } from "./stores";

export type VisitLogStatus = "in_progress" | "submitted";

export interface VisitAnswerInput {
  questionId: string;
  value: string | number | boolean | string[] | null;
  attachments?: string[];
}

export interface UpsertVisitLogInput {
  storeId: string;
  formTemplateId: string;
  routeId?: string;
  assigneeId?: string;
  createdBy?: string;
  visitDate?: string;
  status?: VisitLogStatus;
  answers: VisitAnswerInput[];
}

export type ComplianceStatus = "compliant" | "non_compliant" | "partial";

export interface VisitLogAnswerDTO {
  questionId: string;
  value: string | number | boolean | string[] | null;
  attachments: string[];
  complianceStatus: ComplianceStatus;
  evaluatedAt: string;
  updatedAt: string;
}

export interface VisitLogChangeDTO {
  changedAt: string;
  changedBy?: string;
  changes: Array<{
    questionId: string;
    previous?: VisitLogAnswerDTO;
    current: VisitLogAnswerDTO;
  }>;
}

export interface VisitLogDTO {
  id: string;
  storeId: string;
  formTemplateId: string;
  routeId?: string;
  assigneeId?: string;
  status: VisitLogStatus;
  visitDate: string;
  answers: VisitLogAnswerDTO[];
  history: VisitLogChangeDTO[];
  complianceScore: number;
  createdAt: string;
  updatedAt: string;
}

interface VisitLogAnswerDocument {
  questionId: string;
  value: string | number | boolean | string[] | null;
  attachments: string[];
  complianceStatus: ComplianceStatus;
  evaluatedAt: Date;
  updatedAt: Date;
}

interface VisitLogChangeDocument {
  changedAt: Date;
  changedBy?: ObjectId;
  changes: Array<{
    questionId: string;
    previous?: VisitLogAnswerDocument;
    current: VisitLogAnswerDocument;
  }>;
}

interface VisitLogDocument {
  _id: ObjectId;
  storeId: ObjectId;
  formTemplateId: ObjectId;
  routeId?: ObjectId;
  assigneeId?: ObjectId;
  status: VisitLogStatus;
  visitDate: Date;
  answers: VisitLogAnswerDocument[];
  history: VisitLogChangeDocument[];
  complianceScore: number;
  createdAt?: Date;
  updatedAt?: Date;
}

function sanitizeString(value: string | undefined | null) {
  return (value ?? "").trim();
}

function toObjectId(value: string | undefined | null) {
  const sanitized = sanitizeString(value);
  if (!sanitized) {
    return undefined;
  }
  if (!ObjectId.isValid(sanitized)) {
    throw new Error("Uno de los identificadores proporcionados no es válido");
  }
  return new ObjectId(sanitized);
}

function mapAnswerDocumentToDTO(
  answer: VisitLogAnswerDocument
): VisitLogAnswerDTO {
  return {
    questionId: answer.questionId,
    value: Array.isArray(answer.value) ? [...answer.value] : answer.value,
    attachments: [...answer.attachments],
    complianceStatus: answer.complianceStatus,
    evaluatedAt: answer.evaluatedAt.toISOString(),
    updatedAt: answer.updatedAt.toISOString(),
  } satisfies VisitLogAnswerDTO;
}

function mapChangeDocumentToDTO(
  change: VisitLogChangeDocument
): VisitLogChangeDTO {
  return {
    changedAt: change.changedAt.toISOString(),
    changedBy: change.changedBy?.toHexString(),
    changes: change.changes.map((entry) => ({
      questionId: entry.questionId,
      previous: entry.previous
        ? mapAnswerDocumentToDTO(entry.previous)
        : undefined,
      current: mapAnswerDocumentToDTO(entry.current),
    })),
  } satisfies VisitLogChangeDTO;
}

function mapVisitLogDocumentToDTO(doc: WithId<VisitLogDocument>): VisitLogDTO {
  const createdAt =
    doc.createdAt instanceof Date
      ? doc.createdAt.toISOString()
      : new Date().toISOString();
  const updatedAt =
    doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : createdAt;

  const answers = Array.isArray(doc.answers) ? doc.answers : [];
  const history = Array.isArray(doc.history) ? doc.history : [];

  return {
    id: doc._id.toHexString(),
    storeId: doc.storeId.toHexString(),
    formTemplateId: doc.formTemplateId.toHexString(),
    routeId: doc.routeId?.toHexString(),
    assigneeId: doc.assigneeId?.toHexString(),
    status: doc.status,
    visitDate: doc.visitDate.toISOString(),
    answers: answers.map((answer) => mapAnswerDocumentToDTO(answer)),
    history: history.map((change) => mapChangeDocumentToDTO(change)),
    complianceScore: doc.complianceScore,
    createdAt,
    updatedAt,
  } satisfies VisitLogDTO;
}

function hasMeaningfulValue(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value
    .map((item) => sanitizeString(String(item)))
    .filter((item) => item.length > 0);

  return items.length ? items : null;
}

function evaluateExpectedValue(
  expected: FormQuestionDTO["config"]["expectedValue"],
  value: unknown
) {
  if (expected === undefined) {
    return true;
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(value)) {
      return false;
    }
    const expectedSet = new Set(expected.map(String));
    return value.every((item) => expectedSet.has(String(item)));
  }

  return expected === value;
}

function evaluateAnswerStatus(
  question: FormQuestionDTO,
  value: unknown,
  attachments: string[]
): ComplianceStatus {
  const allowPartial = question.config.allowPartial ?? false;
  const required = question.required;
  const hasValue = hasMeaningfulValue(value) || attachments.length > 0;
  const expected = question.config.expectedValue;

  const markMissing = () => (required ? "non_compliant" : "compliant");

  switch (question.type) {
    case "yes_no": {
      if (typeof value !== "boolean") {
        return hasValue && allowPartial ? "partial" : markMissing();
      }
      if (evaluateExpectedValue(expected, value)) {
        return "compliant";
      }
      return allowPartial ? "partial" : "non_compliant";
    }
    case "number": {
      if (typeof value !== "number" || Number.isNaN(value)) {
        return hasValue && allowPartial ? "partial" : markMissing();
      }
      const { min, max } = question.config;
      if (typeof min === "number" && value < min) {
        return allowPartial ? "partial" : "non_compliant";
      }
      if (typeof max === "number" && value > max) {
        return allowPartial ? "partial" : "non_compliant";
      }
      if (typeof expected === "number" && value !== expected) {
        return allowPartial ? "partial" : "non_compliant";
      }
      return "compliant";
    }
    case "select": {
      if (!hasValue) {
        return markMissing();
      }
      if (typeof value !== "string") {
        return allowPartial ? "partial" : "non_compliant";
      }
      const options = new Set(question.options.map((option) => option.value));
      if (!options.has(value)) {
        return allowPartial ? "partial" : "non_compliant";
      }
      if (expected && !evaluateExpectedValue(expected, value)) {
        return allowPartial ? "partial" : "non_compliant";
      }
      return "compliant";
    }
    case "multi_select": {
      if (!hasValue) {
        return markMissing();
      }
      const values = toStringArray(value);
      if (!values) {
        return allowPartial ? "partial" : "non_compliant";
      }
      const optionValues = new Set(
        question.options.map((option) => option.value)
      );
      const allValid = values.every((item) => optionValues.has(item));
      if (!allValid) {
        return allowPartial ? "partial" : "non_compliant";
      }
      if (Array.isArray(expected)) {
        const expectedSet = new Set(expected.map(String));
        const matchesAll = expectedSet.size
          ? expected.every((item) => values.includes(String(item)))
          : true;
        if (matchesAll) {
          return "compliant";
        }
        return allowPartial ? "partial" : "non_compliant";
      }
      return "compliant";
    }
    case "photo": {
      const minPhotos = question.config.minPhotos ?? 0;
      const maxPhotos = question.config.maxPhotos ?? null;
      if (!attachments.length) {
        return markMissing();
      }
      if (attachments.length < minPhotos) {
        return allowPartial ? "partial" : "non_compliant";
      }
      if (typeof maxPhotos === "number" && attachments.length > maxPhotos) {
        return allowPartial ? "partial" : "non_compliant";
      }
      return "compliant";
    }
    default: {
      if (!hasValue) {
        return markMissing();
      }
      if (expected && !evaluateExpectedValue(expected, value)) {
        return allowPartial ? "partial" : "non_compliant";
      }
      return "compliant";
    }
  }
}

interface EvaluatedAnswer {
  snapshot: VisitLogAnswerDocument;
  status: ComplianceStatus;
}

function buildAnswerSnapshot(
  question: FormQuestionDTO,
  answer?: VisitAnswerInput
): EvaluatedAnswer {
  const now = new Date();
  const rawValue = answer?.value ?? null;
  const attachments = Array.isArray(answer?.attachments)
    ? answer!.attachments
        .map((attachment) => sanitizeString(attachment))
        .filter((attachment) => attachment.length > 0)
    : [];

  let value: VisitLogAnswerDocument["value"] = rawValue;
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    value = trimmed.length ? trimmed : null;
  }
  if (Array.isArray(rawValue)) {
    const items = rawValue
      .map((item) => sanitizeString(String(item)))
      .filter((item) => item.length > 0);
    value = items.length ? items : [];
  }

  const complianceStatus = evaluateAnswerStatus(question, value, attachments);

  const snapshot: VisitLogAnswerDocument = {
    questionId: question.id,
    value,
    attachments,
    complianceStatus,
    evaluatedAt: now,
    updatedAt: now,
  } satisfies VisitLogAnswerDocument;

  return {
    snapshot,
    status: complianceStatus,
  } satisfies EvaluatedAnswer;
}

function diffAnswers(
  previous: VisitLogAnswerDocument[],
  current: VisitLogAnswerDocument[]
) {
  const isSameValue = (
    left: VisitLogAnswerDocument["value"],
    right: VisitLogAnswerDocument["value"]
  ) => {
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) {
        return false;
      }
      return left.every((item, index) => right[index] === item);
    }
    return left === right;
  };

  const previousMap = new Map(
    previous.map((answer) => [answer.questionId, answer])
  );

  const changes: VisitLogChangeDocument["changes"] = [];
  current.forEach((answer) => {
    const before = previousMap.get(answer.questionId);
    const changed =
      !before ||
      !isSameValue(before.value, answer.value) ||
      before.complianceStatus !== answer.complianceStatus ||
      before.attachments.join("|") !== answer.attachments.join("|");
    if (changed) {
      changes.push({
        questionId: answer.questionId,
        previous: before,
        current: answer,
      });
    }
  });

  return changes;
}

export async function recordVisitLog(
  input: UpsertVisitLogInput
): Promise<VisitLogDTO> {
  const storeId = toObjectId(input.storeId);
  const formTemplateId = toObjectId(input.formTemplateId);
  if (!storeId || !formTemplateId) {
    throw new Error("Debes especificar la tienda y el formulario utilizados");
  }

  const routeId = toObjectId(input.routeId);
  const assigneeId = toObjectId(input.assigneeId);
  const createdBy = toObjectId(input.createdBy);
  const visitDate = input.visitDate ? new Date(input.visitDate) : new Date();

  if (Number.isNaN(visitDate.getTime())) {
    throw new Error("La fecha de la visita no es válida");
  }

  const template = await getFormTemplateById(formTemplateId.toHexString());

  const evaluated = template.questions.map((question) => {
    const answer = input.answers.find(
      (item) => item.questionId === question.id
    );
    return {
      question,
      ...buildAnswerSnapshot(question, answer),
    };
  });

  const evaluatedAnswers: VisitLogAnswerDocument[] = evaluated.map(
    (entry) => entry.snapshot
  );

  const complianceSum = evaluated.reduce((acc, entry) => {
    const weight = entry.question.config.weight ?? 1;
    if (entry.status === "compliant") {
      return acc + weight;
    }
    if (entry.status === "partial") {
      return acc + weight * 0.5;
    }
    return acc;
  }, 0);

  const totalWeight = evaluated.reduce(
    (acc, entry) => acc + (entry.question.config.weight ?? 1),
    0
  );

  const complianceScore = totalWeight
    ? Number(((complianceSum / totalWeight) * 100).toFixed(2))
    : 0;

  const collection = await getVisitLogsCollection();

  const existing = await collection.findOne(
    {
      storeId,
      formTemplateId,
      visitDate: {
        $gte: new Date(
          visitDate.getFullYear(),
          visitDate.getMonth(),
          visitDate.getDate()
        ),
        $lte: new Date(
          visitDate.getFullYear(),
          visitDate.getMonth(),
          visitDate.getDate(),
          23,
          59,
          59,
          999
        ),
      },
    },
    { sort: { updatedAt: -1 } }
  );

  const now = new Date();

  if (existing) {
    const doc = existing as WithId<VisitLogDocument>;
    const previousAnswers = doc.answers ?? [];
    const previousHistory = Array.isArray(doc.history) ? doc.history : [];
    const changes = diffAnswers(previousAnswers, evaluatedAnswers);

    const historyEntry: VisitLogChangeDocument | null = changes.length
      ? {
          changedAt: now,
          changedBy: createdBy,
          changes,
        }
      : null;

    const update: Record<string, unknown> = {
      answers: evaluatedAnswers,
      complianceScore,
      status: input.status ?? doc.status,
      updatedAt: now,
    };

    if (historyEntry) {
      update.history = [...previousHistory, historyEntry];
    }

    await collection.updateOne({ _id: doc._id }, { $set: update });

    const updated = await collection.findOne({ _id: doc._id });
    return mapVisitLogDocumentToDTO(updated as WithId<VisitLogDocument>);
  }

  const status: VisitLogStatus = input.status ?? "submitted";

  const doc: VisitLogDocument = {
    _id: new ObjectId(),
    storeId,
    formTemplateId,
    routeId,
    assigneeId,
    status,
    visitDate,
    answers: evaluatedAnswers,
    history: [],
    complianceScore,
    createdAt: now,
    updatedAt: now,
  } satisfies VisitLogDocument;

  if (createdBy) {
    doc.history.push({
      changedAt: now,
      changedBy: createdBy,
      changes: evaluatedAnswers.map((answer) => ({
        questionId: answer.questionId,
        current: answer,
      })),
    });
  }

  await collection.insertOne(doc);
  return mapVisitLogDocumentToDTO(doc as WithId<VisitLogDocument>);
}

export async function getLatestVisitLog(
  storeId: string,
  formTemplateId: string
): Promise<VisitLogDTO | null> {
  if (!ObjectId.isValid(storeId) || !ObjectId.isValid(formTemplateId)) {
    return null;
  }

  const collection = await getVisitLogsCollection();
  const doc = await collection.findOne(
    {
      storeId: new ObjectId(storeId),
      formTemplateId: new ObjectId(formTemplateId),
    },
    { sort: { visitDate: -1, updatedAt: -1 } }
  );

  if (!doc) {
    return null;
  }

  return mapVisitLogDocumentToDTO(doc as WithId<VisitLogDocument>);
}

export async function listVisitLogHistory(
  storeId: string,
  formTemplateId: string,
  limit = 20
): Promise<VisitLogDTO[]> {
  if (!ObjectId.isValid(storeId) || !ObjectId.isValid(formTemplateId)) {
    return [];
  }

  const collection = await getVisitLogsCollection();
  const docs = await collection
    .find({
      storeId: new ObjectId(storeId),
      formTemplateId: new ObjectId(formTemplateId),
    })
    .sort({ visitDate: -1, updatedAt: -1 })
    .limit(limit)
    .toArray();

  return docs.map((doc) =>
    mapVisitLogDocumentToDTO(doc as WithId<VisitLogDocument>)
  );
}

export async function resolveActiveFormForStore(
  storeId: string,
  storeFormat?: StoreFormat
): Promise<FormTemplateDTO | null> {
  return findActiveFormTemplateForStore(storeId, storeFormat);
}

export const __testing = {
  evaluateAnswerStatus,
};
