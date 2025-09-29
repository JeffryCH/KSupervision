import { ObjectId, WithId } from "mongodb";
import { getFormTemplatesCollection } from "./mongodb";
import type { StoreFormat } from "./stores";

export const QUESTION_TYPES = [
  "short_text",
  "long_text",
  "yes_no",
  "number",
  "photo",
  "select",
  "multi_select",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export type FormScopeDTO =
  | { kind: "all" }
  | { kind: "formats"; formats: StoreFormat[] }
  | { kind: "stores"; storeIds: string[] };

export interface FormQuestionOptionDTO {
  id: string;
  value: string;
  label: string;
}

export interface FormQuestionComplianceDTO {
  weight: number;
  expectedValue?: string | string[] | number | boolean;
  min?: number;
  max?: number;
  minPhotos?: number;
  maxPhotos?: number;
  allowPartial?: boolean;
}

export interface FormQuestionDTO {
  id: string;
  type: QuestionType;
  title: string;
  description: string;
  required: boolean;
  order: number;
  options: FormQuestionOptionDTO[];
  config: FormQuestionComplianceDTO;
}

export interface FormTemplateDTO {
  id: string;
  version: number;
  status: "draft" | "published" | "archived";
  name: string;
  description: string;
  scope: FormScopeDTO;
  questions: FormQuestionDTO[];
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFormQuestionInput {
  id?: string;
  type: QuestionType;
  title: string;
  description?: string;
  required?: boolean;
  order?: number;
  options?: Array<{ value: string; label?: string }>;
  compliance?: Partial<FormQuestionComplianceDTO>;
}

export interface CreateFormTemplateInput {
  name: string;
  description?: string;
  createdBy?: string;
  scope:
    | { kind: "all" }
    | { kind: "formats"; formats: StoreFormat[] }
    | { kind: "stores"; storeIds: string[] };
  questions: CreateFormQuestionInput[];
}

export interface UpdateFormTemplateInput {
  name?: string;
  description?: string;
  updatedBy?: string;
  scope?: CreateFormTemplateInput["scope"];
  questions?: CreateFormQuestionInput[];
  status?: "draft" | "published" | "archived";
}

interface FormQuestionOptionDocument {
  optionId: string;
  value: string;
  label: string;
}

interface FormQuestionComplianceDocument {
  weight: number;
  expectedValue?: string | string[] | number | boolean;
  min?: number;
  max?: number;
  minPhotos?: number;
  maxPhotos?: number;
  allowPartial?: boolean;
}

interface FormQuestionDocument {
  questionId: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  order: number;
  options: FormQuestionOptionDocument[];
  compliance: FormQuestionComplianceDocument;
}

interface FormTemplateDocument {
  _id: ObjectId;
  version: number;
  status: "draft" | "published" | "archived";
  name: string;
  description?: string;
  scope:
    | { kind: "all" }
    | { kind: "formats"; formats: StoreFormat[] }
    | { kind: "stores"; storeIds: ObjectId[] };
  questions: FormQuestionDocument[];
  createdBy?: ObjectId;
  updatedBy?: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

function sanitizeString(value: string | undefined | null) {
  return (value ?? "").trim();
}

function assertValidQuestionType(value: QuestionType) {
  if (!QUESTION_TYPES.includes(value)) {
    throw new Error(`Tipo de pregunta no soportado: ${value}`);
  }
}

function normalizeQuestion(
  input: CreateFormQuestionInput,
  index: number
): FormQuestionDocument {
  const type = input.type;
  assertValidQuestionType(type);

  const title = sanitizeString(input.title);
  if (!title) {
    throw new Error("Cada pregunta debe tener un título");
  }

  const questionId = sanitizeString(input.id) || new ObjectId().toHexString();
  const description = sanitizeString(input.description);
  const required = Boolean(input.required ?? false);
  const order = Number.isFinite(input.order) ? Number(input.order) : index;

  const weightRaw = input.compliance?.weight ?? 1;
  const weight = Number.isFinite(weightRaw) && weightRaw > 0 ? weightRaw : 1;

  const options: FormQuestionOptionDocument[] = (input.options ?? []).map(
    (option) => {
      const value = sanitizeString(option.value);
      if (!value) {
        throw new Error("Las opciones de selección deben tener un valor");
      }
      const label = sanitizeString(option.label) || value;
      return {
        optionId: new ObjectId().toHexString(),
        value,
        label,
      } satisfies FormQuestionOptionDocument;
    }
  );

  const compliance: FormQuestionComplianceDocument = {
    weight,
    expectedValue: input.compliance?.expectedValue,
    min: input.compliance?.min,
    max: input.compliance?.max,
    minPhotos: input.compliance?.minPhotos,
    maxPhotos: input.compliance?.maxPhotos,
    allowPartial: input.compliance?.allowPartial ?? false,
  } satisfies FormQuestionComplianceDocument;

  if (type === "select" || type === "multi_select") {
    if (options.length === 0) {
      throw new Error(
        "Las preguntas de selección deben tener al menos una opción"
      );
    }
  }

  if (type === "photo") {
    const minPhotos = compliance.minPhotos ?? 0;
    if (minPhotos < 0) {
      throw new Error("El número mínimo de fotos no puede ser negativo");
    }
  }

  return {
    questionId,
    type,
    title,
    description: description || undefined,
    required,
    order,
    options,
    compliance,
  } satisfies FormQuestionDocument;
}

function mapScopeToDocument(
  scope: CreateFormTemplateInput["scope"]
): FormTemplateDocument["scope"] {
  if (scope.kind === "all") {
    return { kind: "all" };
  }

  if (scope.kind === "formats") {
    const formats = Array.from(
      new Set(scope.formats.map((format) => sanitizeString(format)))
    ).filter((format): format is StoreFormat => Boolean(format));

    if (formats.length === 0) {
      throw new Error(
        "Debes seleccionar al menos un formato para este formulario"
      );
    }

    return { kind: "formats", formats };
  }

  const storeIds = Array.from(
    new Set(
      scope.storeIds
        .map((id) => sanitizeString(id))
        .filter((id) => ObjectId.isValid(id))
    )
  ).map((id) => new ObjectId(id));

  if (storeIds.length === 0) {
    throw new Error("Debes seleccionar al menos una tienda para el formulario");
  }

  return { kind: "stores", storeIds };
}

function mapScopeToDTO(scope: FormTemplateDocument["scope"]): FormScopeDTO {
  if (scope.kind === "all") {
    return { kind: "all" };
  }

  if (scope.kind === "formats") {
    return { kind: "formats", formats: scope.formats };
  }

  return {
    kind: "stores",
    storeIds: scope.storeIds.map((id) => id.toHexString()),
  };
}

function mapQuestionToDTO(question: FormQuestionDocument): FormQuestionDTO {
  return {
    id: question.questionId,
    type: question.type,
    title: question.title,
    description: question.description ?? "",
    required: question.required,
    order: question.order,
    options: question.options.map((option) => ({
      id: option.optionId,
      value: option.value,
      label: option.label,
    })),
    config: {
      weight: question.compliance.weight,
      expectedValue: question.compliance.expectedValue,
      min: question.compliance.min,
      max: question.compliance.max,
      minPhotos: question.compliance.minPhotos,
      maxPhotos: question.compliance.maxPhotos,
      allowPartial: question.compliance.allowPartial,
    },
  } satisfies FormQuestionDTO;
}

function mapTemplateDocumentToDTO(
  doc: WithId<FormTemplateDocument>
): FormTemplateDTO {
  const createdAt =
    doc.createdAt instanceof Date
      ? doc.createdAt.toISOString()
      : new Date().toISOString();
  const updatedAt =
    doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : createdAt;

  return {
    id: doc._id.toHexString(),
    version: doc.version,
    status: doc.status,
    name: doc.name,
    description: doc.description ?? "",
    scope: mapScopeToDTO(doc.scope),
    questions: doc.questions
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((question) => mapQuestionToDTO(question)),
    createdBy: doc.createdBy?.toHexString(),
    updatedBy: doc.updatedBy?.toHexString(),
    createdAt,
    updatedAt,
  } satisfies FormTemplateDTO;
}

export async function createFormTemplate(
  input: CreateFormTemplateInput
): Promise<FormTemplateDTO> {
  const name = sanitizeString(input.name);
  if (!name) {
    throw new Error("El formulario debe tener un nombre");
  }

  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    throw new Error("El formulario debe contener al menos una pregunta");
  }

  const scope = mapScopeToDocument(input.scope);
  const questions = input.questions.map((question, index) =>
    normalizeQuestion(question, index)
  );

  const createdBy =
    input.createdBy && ObjectId.isValid(input.createdBy)
      ? new ObjectId(input.createdBy)
      : undefined;

  const now = new Date();
  const doc: FormTemplateDocument = {
    _id: new ObjectId(),
    version: 1,
    status: "draft",
    name,
    description: sanitizeString(input.description) || undefined,
    scope,
    questions,
    createdBy,
    updatedBy: createdBy,
    createdAt: now,
    updatedAt: now,
  } satisfies FormTemplateDocument;

  const collection = await getFormTemplatesCollection();
  await collection.insertOne(doc);

  return mapTemplateDocumentToDTO(doc);
}

async function fetchTemplateDocument(id: string) {
  if (!ObjectId.isValid(id)) {
    throw new Error("El identificador de formulario no es válido");
  }

  const collection = await getFormTemplatesCollection();
  const doc = await collection.findOne({ _id: new ObjectId(id) });
  if (!doc) {
    throw new Error("El formulario solicitado no existe");
  }

  return doc as WithId<FormTemplateDocument>;
}

export async function getFormTemplateById(id: string) {
  const doc = await fetchTemplateDocument(id);
  return mapTemplateDocumentToDTO(doc);
}

export async function updateFormTemplate(
  id: string,
  input: UpdateFormTemplateInput
): Promise<FormTemplateDTO> {
  const doc = await fetchTemplateDocument(id);

  const set: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const name = sanitizeString(input.name);
    if (!name) {
      throw new Error("El formulario debe tener un nombre");
    }
    set.name = name;
  }

  if (input.description !== undefined) {
    const description = sanitizeString(input.description);
    set.description = description || undefined;
  }

  if (input.scope !== undefined) {
    set.scope = mapScopeToDocument(input.scope);
  }

  if (Array.isArray(input.questions)) {
    if (input.questions.length === 0) {
      throw new Error(
        "El formulario debe contener al menos una pregunta activa"
      );
    }
    const questions = input.questions.map((question, index) =>
      normalizeQuestion(question, index)
    );
    set.questions = questions;
  }

  if (input.status !== undefined) {
    set.status = input.status;
  }

  if (Object.keys(set).length === 0) {
    return mapTemplateDocumentToDTO(doc);
  }

  set.version = doc.version + 1;
  set.updatedAt = new Date();

  if (input.updatedBy && ObjectId.isValid(input.updatedBy)) {
    set.updatedBy = new ObjectId(input.updatedBy);
  }

  const collection = await getFormTemplatesCollection();
  await collection.updateOne({ _id: doc._id }, { $set: set });

  const updated = await fetchTemplateDocument(id);
  return mapTemplateDocumentToDTO(updated);
}

export async function publishFormTemplate(
  id: string,
  input: { scope?: CreateFormTemplateInput["scope"]; updatedBy?: string } = {}
): Promise<FormTemplateDTO> {
  const payload: UpdateFormTemplateInput = {
    status: "published",
  };

  if (input.scope) {
    payload.scope = input.scope;
  }

  if (input.updatedBy) {
    payload.updatedBy = input.updatedBy;
  }

  return updateFormTemplate(id, payload);
}

export async function archiveFormTemplate(
  id: string,
  input: { updatedBy?: string } = {}
): Promise<FormTemplateDTO> {
  return updateFormTemplate(id, {
    status: "archived",
    updatedBy: input.updatedBy,
  });
}

export async function deleteFormTemplate(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) {
    throw new Error("El identificador de formulario no es válido");
  }

  const collection = await getFormTemplatesCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}

export interface ListFormTemplatesFilters {
  status?: Array<"draft" | "published" | "archived">;
  scopeKind?: FormScopeDTO["kind"];
  format?: StoreFormat;
  storeId?: string;
}

export async function listFormTemplates(
  filters: ListFormTemplatesFilters = {}
): Promise<FormTemplateDTO[]> {
  const collection = await getFormTemplatesCollection();
  const query: Record<string, unknown> = {};

  if (filters.status && filters.status.length > 0) {
    query.status = { $in: filters.status };
  }

  if (filters.scopeKind) {
    query["scope.kind"] = filters.scopeKind;
  }

  if (filters.format) {
    query["scope.formats"] = filters.format;
  }

  if (filters.storeId && ObjectId.isValid(filters.storeId)) {
    query.$or = [
      { "scope.kind": "all" },
      {
        $and: [
          { "scope.kind": "formats" },
          { "scope.formats": { $exists: true, $ne: [] } },
        ],
      },
      {
        $and: [
          { "scope.kind": "stores" },
          {
            "scope.storeIds": {
              $in: [new ObjectId(filters.storeId)],
            },
          },
        ],
      },
    ];
  }

  const docs = await collection.find(query).sort({ updatedAt: -1 }).toArray();
  return docs.map((doc) =>
    mapTemplateDocumentToDTO(doc as WithId<FormTemplateDocument>)
  );
}

export async function findActiveFormTemplateForStore(
  storeId: string,
  storeFormat?: StoreFormat
): Promise<FormTemplateDTO | null> {
  if (!ObjectId.isValid(storeId)) {
    return null;
  }

  const collection = await getFormTemplatesCollection();
  const now = new Date();
  const storeCondition = {
    $and: [
      { "scope.kind": "stores" },
      { "scope.storeIds": { $in: [new ObjectId(storeId)] } },
    ],
  };

  const conditions: Record<string, unknown>[] = [
    { "scope.kind": "all" },
    storeCondition,
  ];

  if (storeFormat) {
    conditions.push({
      $and: [
        { "scope.kind": "formats" },
        { "scope.formats": { $in: [storeFormat] } },
      ],
    });
  }

  const query: Record<string, unknown> = {
    status: "published",
    updatedAt: { $lte: now },
    $or: conditions,
  };

  const doc = await collection.findOne(query, {
    sort: { updatedAt: -1, version: -1 },
  });

  if (!doc) {
    return null;
  }

  return mapTemplateDocumentToDTO(doc as WithId<FormTemplateDocument>);
}
