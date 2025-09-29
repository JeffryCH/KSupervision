"use client";

import { MouseEvent, useEffect, useId, useMemo, useState } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import type {
  CreateFormQuestionInput,
  CreateFormTemplateInput,
  FormQuestionDTO,
  FormTemplateDTO,
  FormScopeDTO,
  QuestionType,
} from "@/lib/forms";

const STATUS_LABEL: Record<FormTemplateDTO["status"], string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

const STATUS_BADGE: Record<FormTemplateDTO["status"], string> = {
  draft: "badge admin-badge admin-badge-warning",
  published: "badge admin-badge admin-badge-success",
  archived: "badge admin-badge admin-badge-neutral",
};

const STORE_FORMATS = ["Walmart", "Mas x Menos", "Pali", "Maxi Pali"] as const;

type StoreFormatLiteral = (typeof STORE_FORMATS)[number];

const QUESTION_TYPE_OPTIONS: Array<{ value: QuestionType; label: string }> = [
  { value: "short_text", label: "Texto corto" },
  { value: "long_text", label: "Texto largo" },
  { value: "yes_no", label: "Sí / No" },
  { value: "number", label: "Número" },
  { value: "photo", label: "Fotografía" },
  { value: "select", label: "Selección única" },
  { value: "multi_select", label: "Selección múltiple" },
];

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

type StatusFilter = "all" | FormTemplateDTO["status"];

type ScopeKind = FormScopeDTO["kind"];

interface QuestionOptionDraft {
  localId: string;
  value: string;
  label: string;
}

interface QuestionComplianceDraft {
  weight: number;
  expectedValue: string;
  min: string;
  max: string;
  minPhotos: string;
  maxPhotos: string;
  allowPartial: boolean;
}

interface QuestionDraft {
  localId: string;
  sourceId?: string;
  type: QuestionType;
  title: string;
  description: string;
  required: boolean;
  order: number;
  options: QuestionOptionDraft[];
  compliance: QuestionComplianceDraft;
}

interface EditorInit {
  mode: "create" | "edit";
  template?: FormTemplateDTO | null;
}

interface EditorSubmitPayload {
  name: string;
  description?: string;
  scope: CreateFormTemplateInput["scope"];
  questions: CreateFormQuestionInput[];
}

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

function mapQuestionToDraft(
  question: FormQuestionDTO,
  index: number
): QuestionDraft {
  return {
    localId: randomId("question"),
    sourceId: question.id,
    type: question.type,
    title: question.title,
    description: question.description ?? "",
    required: question.required,
    order: index,
    options: (question.options ?? []).map((option) => ({
      localId: randomId("option"),
      value: option.value,
      label: option.label ?? option.value,
    })),
    compliance: {
      weight: question.config?.weight ?? 1,
      expectedValue:
        typeof question.config?.expectedValue === "string"
          ? question.config?.expectedValue
          : Array.isArray(question.config?.expectedValue)
          ? question.config?.expectedValue.join(", ")
          : question.config?.expectedValue !== undefined
          ? String(question.config?.expectedValue)
          : "",
      min:
        question.config?.min !== undefined && question.config?.min !== null
          ? String(question.config.min)
          : "",
      max:
        question.config?.max !== undefined && question.config?.max !== null
          ? String(question.config.max)
          : "",
      minPhotos:
        question.config?.minPhotos !== undefined &&
        question.config?.minPhotos !== null
          ? String(question.config.minPhotos)
          : "",
      maxPhotos:
        question.config?.maxPhotos !== undefined &&
        question.config?.maxPhotos !== null
          ? String(question.config.maxPhotos)
          : "",
      allowPartial: Boolean(question.config?.allowPartial),
    },
  } satisfies QuestionDraft;
}

function createQuestionDraft(type: QuestionType, order: number): QuestionDraft {
  return {
    localId: randomId("question"),
    type,
    title: "",
    description: "",
    required: false,
    order,
    options:
      type === "select" || type === "multi_select"
        ? [
            { localId: randomId("option"), value: "", label: "" },
            { localId: randomId("option"), value: "", label: "" },
          ]
        : [],
    compliance: {
      weight: 1,
      expectedValue: "",
      min: "",
      max: "",
      minPhotos: "",
      maxPhotos: "",
      allowPartial: false,
    },
  };
}

function mapScopeToState(scope: FormScopeDTO): {
  kind: ScopeKind;
  formats: string[];
  storeIds: string[];
} {
  if (scope.kind === "all") {
    return { kind: "all", formats: [], storeIds: [] };
  }
  if (scope.kind === "formats") {
    return {
      kind: "formats",
      formats: [...scope.formats],
      storeIds: [],
    };
  }
  return {
    kind: "stores",
    formats: [],
    storeIds: [...scope.storeIds],
  };
}

function createEmptyScopeState(): {
  kind: ScopeKind;
  formats: string[];
  storeIds: string[];
} {
  return { kind: "all", formats: [], storeIds: [] };
}

function buildScopePayload(
  kind: ScopeKind,
  formats: string[],
  storeIds: string[]
): CreateFormTemplateInput["scope"] {
  if (kind === "all") {
    return { kind: "all" };
  }
  if (kind === "formats") {
    const normalized = Array.from(
      new Set(
        formats
          .map((format) => format.trim())
          .filter((format): format is string => Boolean(format))
      )
    ).filter((format): format is StoreFormatLiteral =>
      STORE_FORMATS.includes(format as StoreFormatLiteral)
    );

    return {
      kind: "formats",
      formats: normalized,
    };
  }
  return {
    kind: "stores",
    storeIds: Array.from(
      new Set(
        storeIds
          .map((id) => id.trim())
          .filter((id): id is string => Boolean(id))
      )
    ),
  };
}

function parseExpectedValue(type: QuestionType, value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (type === "yes_no") {
    const normalized = trimmed.toLowerCase();
    if (["si", "sí", "true", "1", "yes"].includes(normalized)) return true;
    if (["no", "false", "0"].includes(normalized)) return false;
    return trimmed;
  }

  if (type === "number") {
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : trimmed;
  }

  if (type === "multi_select") {
    return trimmed
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return trimmed;
}

function mapDraftToPayload(
  name: string,
  description: string,
  kind: ScopeKind,
  formats: string[],
  storeIds: string[],
  questions: QuestionDraft[]
): EditorSubmitPayload {
  const scope = buildScopePayload(kind, formats, storeIds);

  const sanitizedQuestions = questions
    .slice()
    .sort((a, b) => a.order - b.order)
    .map<CreateFormQuestionInput>((question, index) => {
      const options =
        question.type === "select" || question.type === "multi_select"
          ? question.options
              .map((option) => ({
                value: option.value.trim(),
                label: option.label.trim() || undefined,
              }))
              .filter((option) => option.value.length > 0)
          : undefined;

      const compliance: CreateFormQuestionInput["compliance"] = {
        weight: question.compliance.weight || 1,
        expectedValue: parseExpectedValue(
          question.type,
          question.compliance.expectedValue
        ),
        min: question.compliance.min
          ? Number(question.compliance.min)
          : undefined,
        max: question.compliance.max
          ? Number(question.compliance.max)
          : undefined,
        minPhotos: question.compliance.minPhotos
          ? Number(question.compliance.minPhotos)
          : undefined,
        maxPhotos: question.compliance.maxPhotos
          ? Number(question.compliance.maxPhotos)
          : undefined,
        allowPartial: question.compliance.allowPartial,
      };

      Object.keys(compliance).forEach((key) => {
        const typedKey = key as keyof typeof compliance;
        if (
          compliance[typedKey] === undefined ||
          compliance[typedKey] === null ||
          (typeof compliance[typedKey] === "number" &&
            Number.isNaN(compliance[typedKey] as number))
        ) {
          delete compliance[typedKey];
        }
      });

      return {
        id: question.sourceId,
        type: question.type,
        title: question.title.trim(),
        description: question.description.trim() || undefined,
        required: question.required,
        order: index,
        options,
        compliance,
      } satisfies CreateFormQuestionInput;
    });

  return {
    name: name.trim(),
    description: description.trim() || undefined,
    scope,
    questions: sanitizedQuestions,
  } satisfies EditorSubmitPayload;
}

function validateDraft(
  name: string,
  kind: ScopeKind,
  formats: string[],
  storeIds: string[],
  questions: QuestionDraft[]
) {
  const errors: string[] = [];

  if (!name.trim()) {
    errors.push("El formulario debe tener un nombre.");
  }

  if (
    kind === "formats" &&
    formats.filter((format) => format.trim()).length === 0
  ) {
    errors.push("Debes seleccionar al menos un formato para el alcance.");
  }

  if (kind === "stores" && storeIds.filter((id) => id.trim()).length === 0) {
    errors.push("Debes ingresar al menos una tienda para el alcance.");
  }

  if (questions.length === 0) {
    errors.push("Agrega al menos una pregunta al formulario.");
  }

  questions.forEach((question, index) => {
    if (!question.title.trim()) {
      errors.push(`La pregunta ${index + 1} debe tener un título.`);
    }

    if (
      (question.type === "select" || question.type === "multi_select") &&
      question.options.filter((option) => option.value.trim()).length === 0
    ) {
      errors.push(
        `La pregunta ${
          index + 1
        } necesita al menos una opción con un valor válido.`
      );
    }

    if (question.compliance.weight <= 0) {
      errors.push(
        `La pregunta ${
          index + 1
        } debe tener un peso de cumplimiento mayor a cero.`
      );
    }

    if (
      question.type === "photo" &&
      question.compliance.minPhotos &&
      Number(question.compliance.minPhotos) < 0
    ) {
      errors.push(
        `La pregunta ${index + 1} no puede tener un mínimo de fotos negativo.`
      );
    }
  });

  return errors;
}

async function apiFetchTemplates() {
  const response = await fetch("/api/forms?status=draft,published,archived", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  const data = (await response.json()) as ApiResponse<FormTemplateDTO[]>;
  if (!response.ok || !data.success || !data.data) {
    throw new Error(data.message ?? "No se pudieron cargar los formularios");
  }
  return data.data;
}

async function apiCreateTemplate(payload: EditorSubmitPayload) {
  const response = await fetch("/api/forms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload satisfies CreateFormTemplateInput),
  });
  const data = (await response.json()) as ApiResponse<FormTemplateDTO>;
  if (!response.ok || !data.success || !data.data) {
    throw new Error(data.message ?? "No se pudo crear el formulario");
  }
  return data.data;
}

async function apiUpdateTemplate(id: string, payload: EditorSubmitPayload) {
  const response = await fetch(`/api/forms/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload satisfies EditorSubmitPayload),
  });
  const data = (await response.json()) as ApiResponse<FormTemplateDTO>;
  if (!response.ok || !data.success || !data.data) {
    throw new Error(data.message ?? "No se pudo actualizar el formulario");
  }
  return data.data;
}

async function apiPublishTemplate(
  id: string,
  scope?: CreateFormTemplateInput["scope"]
) {
  const response = await fetch(`/api/forms/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "publish",
      scope,
    }),
  });
  const data = (await response.json()) as ApiResponse<FormTemplateDTO>;
  if (!response.ok || !data.success || !data.data) {
    throw new Error(data.message ?? "No se pudo publicar el formulario");
  }
  return data.data;
}

async function apiArchiveTemplate(id: string) {
  const response = await fetch(`/api/forms/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "archive",
    }),
  });
  const data = (await response.json()) as ApiResponse<FormTemplateDTO>;
  if (!response.ok || !data.success || !data.data) {
    throw new Error(data.message ?? "No se pudo archivar el formulario");
  }
  return data.data;
}

async function apiDeleteTemplate(id: string) {
  const response = await fetch(`/api/forms/${id}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });
  const data = (await response.json()) as ApiResponse<null>;
  if (!response.ok || !data.success) {
    throw new Error(data.message ?? "No se pudo eliminar el formulario");
  }
}

function formatScope(scope: FormScopeDTO) {
  if (scope.kind === "all") {
    return "Todas las tiendas";
  }
  if (scope.kind === "formats") {
    return `Formatos: ${scope.formats.join(", ")}`;
  }
  return `Tiendas específicas (${scope.storeIds.length})`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminFormsPage() {
  const [templates, setTemplates] = useState<FormTemplateDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editor, setEditor] = useState<EditorInit | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const modalTitleId = useId();

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        setIsLoading(true);
        setLoadError(null);
        const data = await apiFetchTemplates();
        if (!ignore) {
          setTemplates(data);
        }
      } catch (error) {
        console.error(error);
        if (!ignore) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Ocurrió un error al cargar los formularios"
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  async function refreshTemplates() {
    try {
      setIsRefreshing(true);
      const data = await apiFetchTemplates();
      setTemplates(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditor(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor]);

  function handleEditorBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      setEditor(null);
    }
  }

  const filteredTemplates = useMemo(() => {
    if (statusFilter === "all") {
      return templates;
    }
    return templates.filter((template) => template.status === statusFilter);
  }, [templates, statusFilter]);

  return (
    <AdminGuard>
      <main className="admin-dashboard-wrapper">
        <div className="container">
          <section className="admin-dashboard-hero mb-5">
            <div className="d-inline-flex align-items-center gap-2 mb-3 px-3 py-2 rounded-pill bg-gradient">
              <span className="auth-badge mb-0">Gestor de formularios</span>
            </div>
            <h1 className="display-5 fw-bold mb-3">
              Construcción de formularios de visitas
            </h1>
            <p className="lead text-muted mb-4">
              Diseña, publica y versiona las plantillas utilizadas en la
              bitácora móvil. Controla el alcance por formato o tienda y mantén
              el historial de cambios centralizado.
            </p>
            <div className="d-flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => setEditor({ mode: "create", template: null })}
              >
                Crear nuevo formulario
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={refreshTemplates}
                disabled={isRefreshing}
              >
                {isRefreshing ? "Actualizando…" : "Actualizar listado"}
              </button>
            </div>
          </section>

          <section className="card admin-card border-0 mb-5">
            <div className="card-body p-4 p-lg-5">
              <div className="d-flex flex-column flex-md-row gap-3 justify-content-between mb-4">
                <div>
                  <h2 className="h4 mb-1">Formularios disponibles</h2>
                  <p className="text-muted mb-0">
                    {isLoading
                      ? "Cargando formularios…"
                      : `${filteredTemplates.length} formularios encontrados`}
                  </p>
                </div>
                <div className="d-flex gap-2 align-items-center">
                  <label
                    htmlFor="statusFilter"
                    className="form-label fw-semibold mb-0"
                  >
                    Estado
                  </label>
                  <select
                    id="statusFilter"
                    className="form-select"
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as StatusFilter)
                    }
                  >
                    <option value="all">Todos</option>
                    <option value="draft">Borradores</option>
                    <option value="published">Publicados</option>
                    <option value="archived">Archivados</option>
                  </select>
                </div>
              </div>

              {loadError && (
                <div className="alert admin-alert alert-danger" role="alert">
                  {loadError}
                </div>
              )}

              {!isLoading && filteredTemplates.length === 0 && !loadError && (
                <div className="text-center text-muted py-5">
                  <p className="mb-2 fw-semibold">
                    No hay formularios registrados.
                  </p>
                  <p className="mb-0">
                    Crea tu primera plantilla para comenzar a capturar
                    bitácoras.
                  </p>
                </div>
              )}

              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th scope="col">Nombre</th>
                      <th scope="col">Versión</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Alcance</th>
                      <th scope="col">Actualizado</th>
                      <th scope="col" className="text-end">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTemplates.map((template) => (
                      <tr key={template.id}>
                        <td>
                          <div className="fw-semibold">{template.name}</div>
                          {template.description && (
                            <div className="text-muted small">
                              {template.description}
                            </div>
                          )}
                        </td>
                        <td>v{template.version}</td>
                        <td>
                          <span className={STATUS_BADGE[template.status]}>
                            {STATUS_LABEL[template.status]}
                          </span>
                        </td>
                        <td>{formatScope(template.scope)}</td>
                        <td>{formatDate(template.updatedAt)}</td>
                        <td className="text-end">
                          <div className="btn-group" role="group">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() =>
                                setEditor({ mode: "edit", template })
                              }
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() =>
                                setEditor({ mode: "edit", template })
                              }
                            >
                              Ver
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {editor && (
            <>
              <div
                className="modal fade show d-block admin-modal"
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby={modalTitleId}
                onClick={handleEditorBackdropClick}
              >
                <div
                  className="modal-dialog modal-xxl modal-dialog-centered modal-dialog-scrollable admin-modal-dialog"
                  role="document"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="modal-content admin-modal-content admin-card">
                    <FormEditor
                      key={editor.template?.id ?? "new"}
                      mode={editor.mode}
                      template={editor.template ?? null}
                      onClose={() => setEditor(null)}
                      onCreated={async (template) => {
                        await refreshTemplates();
                        setEditor({ mode: "edit", template });
                      }}
                      onUpdated={async (template) => {
                        await refreshTemplates();
                        setEditor({ mode: "edit", template });
                      }}
                      onDeleted={async (id) => {
                        await refreshTemplates();
                        setEditor(null);
                        setTemplates((prev) =>
                          prev.filter((form) => form.id !== id)
                        );
                      }}
                      titleId={modalTitleId}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-backdrop fade show admin-modal-backdrop" />
            </>
          )}
        </div>
      </main>
    </AdminGuard>
  );
}

interface FormEditorProps {
  mode: "create" | "edit";
  template: FormTemplateDTO | null;
  onClose: () => void;
  onCreated: (template: FormTemplateDTO) => Promise<void> | void;
  onUpdated: (template: FormTemplateDTO) => Promise<void> | void;
  onDeleted: (id: string) => Promise<void> | void;
  titleId: string;
}

function FormEditor({
  mode,
  template,
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
  titleId,
}: FormEditorProps) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const initialScope = template
    ? mapScopeToState(template.scope)
    : createEmptyScopeState();
  const [scopeKind, setScopeKind] = useState<ScopeKind>(initialScope.kind);
  const [scopeFormats, setScopeFormats] = useState<string[]>(
    initialScope.formats
  );
  const [scopeStoreIds, setScopeStoreIds] = useState<string[]>(
    initialScope.storeIds
  );
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    template ? template.questions.map(mapQuestionToDraft) : []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    setName(template?.name ?? "");
    setDescription(template?.description ?? "");
    const mapped = template
      ? mapScopeToState(template.scope)
      : createEmptyScopeState();
    setScopeKind(mapped.kind);
    setScopeFormats(mapped.formats);
    setScopeStoreIds(mapped.storeIds);
    setQuestions(template ? template.questions.map(mapQuestionToDraft) : []);
    setFeedback(null);
    setError(null);
    setShowValidation(false);
  }, [template, mode]);

  function handleScopeFormatChange(index: number, value: string) {
    setScopeFormats((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handleScopeStoreChange(index: number, value: string) {
    setScopeStoreIds((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function addScopeFormat() {
    setScopeFormats((prev) => [...prev, ""]);
  }

  function addScopeStore() {
    setScopeStoreIds((prev) => [...prev, ""]);
  }

  function removeScopeFormat(index: number) {
    setScopeFormats((prev) => prev.filter((_, idx) => idx !== index));
  }

  function removeScopeStore(index: number) {
    setScopeStoreIds((prev) => prev.filter((_, idx) => idx !== index));
  }

  function addQuestion(type: QuestionType) {
    setQuestions((prev) => {
      const next = [...prev, createQuestionDraft(type, prev.length)];
      return next.map((question, index) => ({ ...question, order: index }));
    });
  }

  function updateQuestion(localId: string, updates: Partial<QuestionDraft>) {
    setQuestions((prev) =>
      prev.map((question) =>
        question.localId === localId ? { ...question, ...updates } : question
      )
    );
  }

  function updateQuestionCompliance(
    localId: string,
    updates: Partial<QuestionComplianceDraft>
  ) {
    setQuestions((prev) =>
      prev.map((question) =>
        question.localId === localId
          ? { ...question, compliance: { ...question.compliance, ...updates } }
          : question
      )
    );
  }

  function addOption(questionId: string) {
    setQuestions((prev) =>
      prev.map((question) =>
        question.localId === questionId
          ? {
              ...question,
              options: [
                ...question.options,
                { localId: randomId("option"), value: "", label: "" },
              ],
            }
          : question
      )
    );
  }

  function updateOption(
    questionId: string,
    optionId: string,
    updates: Partial<QuestionOptionDraft>
  ) {
    setQuestions((prev) =>
      prev.map((question) =>
        question.localId === questionId
          ? {
              ...question,
              options: question.options.map((option) =>
                option.localId === optionId ? { ...option, ...updates } : option
              ),
            }
          : question
      )
    );
  }

  function removeOption(questionId: string, optionId: string) {
    setQuestions((prev) =>
      prev.map((question) =>
        question.localId === questionId
          ? {
              ...question,
              options: question.options.filter(
                (option) => option.localId !== optionId
              ),
            }
          : question
      )
    );
  }

  function removeQuestion(localId: string) {
    setQuestions((prev) =>
      prev
        .filter((question) => question.localId !== localId)
        .map((question, index) => ({ ...question, order: index }))
    );
  }

  function moveQuestion(localId: string, direction: -1 | 1) {
    setQuestions((prev) => {
      const index = prev.findIndex((question) => question.localId === localId);
      if (index === -1) return prev;
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      next.splice(newIndex, 0, removed);
      return next.map((question, idx) => ({ ...question, order: idx }));
    });
  }

  function buildPayload() {
    return mapDraftToPayload(
      name,
      description,
      scopeKind,
      scopeFormats,
      scopeStoreIds,
      questions
    );
  }

  async function handleSaveDraft() {
    const errors = validateDraft(
      name,
      scopeKind,
      scopeFormats,
      scopeStoreIds,
      questions
    );

    if (errors.length > 0) {
      setShowValidation(true);
      setError(errors.join("\n"));
      return;
    }

    const payload = buildPayload();
    setIsSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      if (mode === "create" || !template) {
        const created = await apiCreateTemplate(payload);
        setFeedback("Formulario guardado como borrador.");
        await onCreated(created);
      } else {
        const updated = await apiUpdateTemplate(template.id, payload);
        setFeedback("Cambios guardados correctamente.");
        await onUpdated(updated);
      }
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el formulario"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePublish() {
    const errors = validateDraft(
      name,
      scopeKind,
      scopeFormats,
      scopeStoreIds,
      questions
    );

    if (errors.length > 0) {
      setShowValidation(true);
      setError(errors.join("\n"));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      if (mode === "create" || !template) {
        const payload = buildPayload();
        const created = await apiCreateTemplate(payload);
        const published = await apiPublishTemplate(created.id, payload.scope);
        setFeedback("Formulario publicado correctamente.");
        await onCreated(published);
      } else {
        const payload = buildPayload();
        await apiUpdateTemplate(template.id, payload);
        const published = await apiPublishTemplate(template.id, payload.scope);
        setFeedback("Formulario publicado correctamente.");
        await onUpdated(published);
      }
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo publicar el formulario"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleArchive() {
    if (!template) return;
    setIsSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      const archived = await apiArchiveTemplate(template.id);
      setFeedback("Formulario archivado.");
      await onUpdated(archived);
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo archivar el formulario"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!template) return;
    const confirmation = window.confirm(
      "¿Seguro que deseas eliminar este formulario? Esta acción no se puede deshacer."
    );
    if (!confirmation) return;

    setIsSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      await apiDeleteTemplate(template.id);
      await onDeleted(template.id);
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el formulario"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const validationMessages = useMemo(() => {
    if (!showValidation) return [] as string[];
    return validateDraft(
      name,
      scopeKind,
      scopeFormats,
      scopeStoreIds,
      questions
    );
  }, [showValidation, name, scopeKind, scopeFormats, scopeStoreIds, questions]);

  const headingText =
    mode === "create"
      ? "Nuevo formulario"
      : template?.name ?? "Editar formulario";

  return (
    <section className="card admin-card border-0 mb-5">
      <div className="card-body p-4 p-lg-5">
        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
          <div>
            <h2 id={titleId} className="h4 mb-1">
              {headingText}
            </h2>
            {template?.status && (
              <span className={`${STATUS_BADGE[template.status]} me-2`}>
                {STATUS_LABEL[template.status]}
              </span>
            )}
            {template?.version && (
              <span className="badge admin-badge admin-badge-neutral">
                v{template.version}
              </span>
            )}
          </div>
          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
            >
              Guardar borrador
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePublish}
              disabled={isSubmitting}
            >
              Publicar
            </button>
            {template && (
              <button
                type="button"
                className="btn btn-warning"
                onClick={handleArchive}
                disabled={isSubmitting || template.status === "archived"}
              >
                Archivar
              </button>
            )}
            {template && (
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                Eliminar
              </button>
            )}
          </div>
        </div>

        {feedback && (
          <div className="alert admin-alert alert-success" role="alert">
            {feedback}
          </div>
        )}

        {error && (
          <div className="alert admin-alert alert-danger" role="alert">
            <p className="mb-0">
              {error.split("\n").map((line, index) => (
                <span key={`${line}-${index}`}>
                  {line}
                  {index < error.split("\n").length - 1 && <br />}
                </span>
              ))}
            </p>
          </div>
        )}

        {validationMessages.length > 0 && (
          <div className="alert admin-alert alert-warning" role="alert">
            <ul className="mb-0">
              {validationMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="row g-4">
          <div className="col-lg-5">
            <div className="mb-4">
              <label htmlFor="formName" className="form-label fw-semibold">
                Nombre del formulario
              </label>
              <input
                id="formName"
                type="text"
                className="form-control"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Bitácora de visita semanal"
              />
            </div>

            <div className="mb-4">
              <label
                htmlFor="formDescription"
                className="form-label fw-semibold"
              >
                Descripción
              </label>
              <textarea
                id="formDescription"
                className="form-control"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe brevemente el objetivo de este formulario"
              />
            </div>

            <div className="mb-4">
              <h3 className="h6 fw-semibold mb-3">Alcance</h3>
              <div className="mb-3">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="scopeKind"
                    id="scopeAll"
                    value="all"
                    checked={scopeKind === "all"}
                    onChange={() => setScopeKind("all")}
                  />
                  <label className="form-check-label" htmlFor="scopeAll">
                    Todas las tiendas
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="scopeKind"
                    id="scopeFormats"
                    value="formats"
                    checked={scopeKind === "formats"}
                    onChange={() => setScopeKind("formats")}
                  />
                  <label className="form-check-label" htmlFor="scopeFormats">
                    Por formato
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="scopeKind"
                    id="scopeStores"
                    value="stores"
                    checked={scopeKind === "stores"}
                    onChange={() => setScopeKind("stores")}
                  />
                  <label className="form-check-label" htmlFor="scopeStores">
                    Tiendas específicas
                  </label>
                </div>
              </div>

              {scopeKind === "formats" && (
                <div className="admin-muted-panel p-3">
                  <p className="small text-muted mb-2">
                    Selecciona los formatos que deben completar esta plantilla.
                  </p>
                  {scopeFormats.map((format, index) => (
                    <div className="d-flex gap-2 mb-2" key={`format-${index}`}>
                      <select
                        className="form-select"
                        value={format}
                        onChange={(event) =>
                          handleScopeFormatChange(index, event.target.value)
                        }
                        aria-label={`Formato ${index + 1}`}
                      >
                        <option value="">Selecciona un formato</option>
                        {STORE_FORMATS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-outline-danger"
                        onClick={() => removeScopeFormat(index)}
                        aria-label="Eliminar formato"
                      >
                        <i className="fas fa-trash" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={addScopeFormat}
                  >
                    Agregar formato
                  </button>
                </div>
              )}

              {scopeKind === "stores" && (
                <div className="admin-muted-panel p-3">
                  <p className="small text-muted mb-2">
                    Ingresa los IDs de tienda (uno por línea) que deben utilizar
                    esta plantilla.
                  </p>
                  {scopeStoreIds.map((storeId, index) => (
                    <div className="d-flex gap-2 mb-2" key={`store-${index}`}>
                      <input
                        type="text"
                        className="form-control"
                        value={storeId}
                        onChange={(event) =>
                          handleScopeStoreChange(index, event.target.value)
                        }
                        placeholder="ID de tienda"
                        aria-label={`ID de tienda ${index + 1}`}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-danger"
                        onClick={() => removeScopeStore(index)}
                        aria-label="Eliminar tienda"
                      >
                        <i className="fas fa-trash" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={addScopeStore}
                  >
                    Agregar tienda
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="col-lg-7">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 className="h6 fw-semibold mb-0">Preguntas</h3>
              <div className="d-flex gap-2">
                <select
                  className="form-select"
                  onChange={(event) => {
                    const value = event.target.value as QuestionType | "";
                    if (value) {
                      addQuestion(value as QuestionType);
                      event.target.value = "";
                    }
                  }}
                  aria-label="Agregar una nueva pregunta"
                >
                  <option value="">Agregar pregunta…</option>
                  {QUESTION_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {questions.length === 0 && (
              <div className="admin-empty-state" role="alert">
                <p className="mb-1 fw-semibold">Aún no hay preguntas.</p>
                <p className="mb-0">
                  Usa el selector superior para agregar diferentes tipos de
                  preguntas al formulario.
                </p>
              </div>
            )}

            <div className="accordion" id="questionsAccordion">
              {questions
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((question, index) => {
                  const titleId = `question-title-${question.localId}`;
                  const typeId = `question-type-${question.localId}`;
                  const descriptionId = `question-description-${question.localId}`;
                  const weightId = `question-weight-${question.localId}`;
                  const expectedValueId = `question-expected-${question.localId}`;
                  const minId = `question-min-${question.localId}`;
                  const maxId = `question-max-${question.localId}`;
                  const minPhotosId = `question-min-photos-${question.localId}`;
                  const maxPhotosId = `question-max-photos-${question.localId}`;
                  const allowPartialId = `question-allow-partial-${question.localId}`;

                  return (
                    <div className="accordion-item mb-3" key={question.localId}>
                      <h2
                        className="accordion-header"
                        id={`heading-${question.localId}`}
                      >
                        <button
                          className="accordion-button collapsed"
                          type="button"
                          data-bs-toggle="collapse"
                          data-bs-target={`#collapse-${question.localId}`}
                          aria-expanded="false"
                          aria-controls={`collapse-${question.localId}`}
                        >
                          <div className="d-flex flex-column w-100">
                            <span className="fw-semibold">
                              {index + 1}.{" "}
                              {question.title || "Pregunta sin título"}
                            </span>
                            <span className="small text-muted">
                              {QUESTION_TYPE_OPTIONS.find(
                                (option) => option.value === question.type
                              )?.label ?? question.type}
                            </span>
                          </div>
                        </button>
                      </h2>
                      <div
                        id={`collapse-${question.localId}`}
                        className="accordion-collapse collapse"
                        aria-labelledby={`heading-${question.localId}`}
                        data-bs-parent="#questionsAccordion"
                      >
                        <div className="accordion-body">
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <div className="btn-group" role="group">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() =>
                                  moveQuestion(question.localId, -1)
                                }
                                disabled={index === 0}
                                aria-label="Mover pregunta hacia arriba"
                              >
                                <i
                                  className="fas fa-arrow-up"
                                  aria-hidden="true"
                                />
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() =>
                                  moveQuestion(question.localId, 1)
                                }
                                disabled={index === questions.length - 1}
                                aria-label="Mover pregunta hacia abajo"
                              >
                                <i
                                  className="fas fa-arrow-down"
                                  aria-hidden="true"
                                />
                              </button>
                            </div>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeQuestion(question.localId)}
                              aria-label="Eliminar pregunta"
                            >
                              Eliminar
                            </button>
                          </div>

                          <div className="row g-3">
                            <div className="col-md-8">
                              <label
                                className="form-label fw-semibold"
                                htmlFor={titleId}
                              >
                                Título de la pregunta
                              </label>
                              <input
                                id={titleId}
                                type="text"
                                className="form-control"
                                value={question.title}
                                onChange={(event) =>
                                  updateQuestion(question.localId, {
                                    title: event.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="col-md-4">
                              <label
                                className="form-label fw-semibold"
                                htmlFor={typeId}
                              >
                                Tipo
                              </label>
                              <select
                                id={typeId}
                                className="form-select"
                                value={question.type}
                                onChange={(event) =>
                                  updateQuestion(question.localId, {
                                    type: event.target.value as QuestionType,
                                    options:
                                      event.target.value === "select" ||
                                      event.target.value === "multi_select"
                                        ? question.options.length > 0
                                          ? question.options
                                          : [
                                              {
                                                localId: randomId("option"),
                                                value: "",
                                                label: "",
                                              },
                                            ]
                                        : [],
                                  })
                                }
                              >
                                {QUESTION_TYPE_OPTIONS.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="mt-3">
                            <label
                              className="form-label fw-semibold"
                              htmlFor={descriptionId}
                            >
                              Descripción / ayuda
                            </label>
                            <textarea
                              id={descriptionId}
                              className="form-control"
                              rows={2}
                              value={question.description}
                              onChange={(event) =>
                                updateQuestion(question.localId, {
                                  description: event.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="form-check form-switch mt-3">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`required-${question.localId}`}
                              checked={question.required}
                              onChange={(event) =>
                                updateQuestion(question.localId, {
                                  required: event.target.checked,
                                })
                              }
                            />
                            <label
                              className="form-check-label"
                              htmlFor={`required-${question.localId}`}
                            >
                              Respuesta obligatoria
                            </label>
                          </div>

                          {(question.type === "select" ||
                            question.type === "multi_select") && (
                            <div className="mt-4">
                              <h4 className="h6 fw-semibold">Opciones</h4>
                              <p className="small text-muted">
                                Define las opciones que estarán disponibles para
                                la respuesta.
                              </p>
                              {question.options.map((option) => {
                                const optionValueId = `question-${question.localId}-option-${option.localId}-value`;
                                const optionLabelId = `question-${question.localId}-option-${option.localId}-label`;

                                return (
                                  <div
                                    className="row g-2 align-items-center mb-2"
                                    key={option.localId}
                                  >
                                    <div className="col-md-5">
                                      <label
                                        className="form-label visually-hidden"
                                        htmlFor={optionValueId}
                                      >
                                        Valor de la opción
                                      </label>
                                      <input
                                        id={optionValueId}
                                        type="text"
                                        className="form-control"
                                        placeholder="Valor"
                                        value={option.value}
                                        onChange={(event) =>
                                          updateOption(
                                            question.localId,
                                            option.localId,
                                            {
                                              value: event.target.value,
                                            }
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="col-md-5">
                                      <label
                                        className="form-label visually-hidden"
                                        htmlFor={optionLabelId}
                                      >
                                        Etiqueta de la opción
                                      </label>
                                      <input
                                        id={optionLabelId}
                                        type="text"
                                        className="form-control"
                                        placeholder="Etiqueta opcional"
                                        value={option.label}
                                        onChange={(event) =>
                                          updateOption(
                                            question.localId,
                                            option.localId,
                                            {
                                              label: event.target.value,
                                            }
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="col-md-2 text-end">
                                      <button
                                        type="button"
                                        className="btn btn-outline-danger"
                                        onClick={() =>
                                          removeOption(
                                            question.localId,
                                            option.localId
                                          )
                                        }
                                        aria-label="Eliminar opción"
                                      >
                                        <i
                                          className="fas fa-trash"
                                          aria-hidden="true"
                                        />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => addOption(question.localId)}
                                aria-label="Agregar opción de respuesta"
                              >
                                Agregar opción
                              </button>
                            </div>
                          )}

                          <div className="mt-4">
                            <h4 className="h6 fw-semibold">
                              Configuración de cumplimiento
                            </h4>
                            <div className="row g-2">
                              <div className="col-md-4">
                                <label
                                  className="form-label"
                                  htmlFor={weightId}
                                >
                                  Peso
                                </label>
                                <input
                                  id={weightId}
                                  type="number"
                                  className="form-control"
                                  min={0}
                                  step={0.1}
                                  value={question.compliance.weight}
                                  onChange={(event) =>
                                    updateQuestionCompliance(question.localId, {
                                      weight: Number(event.target.value) || 0,
                                    })
                                  }
                                />
                              </div>
                              <div className="col-md-8">
                                <label
                                  className="form-label"
                                  htmlFor={expectedValueId}
                                >
                                  Valor esperado
                                </label>
                                <input
                                  id={expectedValueId}
                                  type="text"
                                  className="form-control"
                                  value={question.compliance.expectedValue}
                                  onChange={(event) =>
                                    updateQuestionCompliance(question.localId, {
                                      expectedValue: event.target.value,
                                    })
                                  }
                                  placeholder="Ej. sí, 10, opción_1"
                                />
                              </div>
                            </div>

                            <div className="row g-2 mt-2">
                              <div className="col-md-3">
                                <label className="form-label" htmlFor={minId}>
                                  Mínimo
                                </label>
                                <input
                                  id={minId}
                                  type="number"
                                  className="form-control"
                                  value={question.compliance.min}
                                  onChange={(event) =>
                                    updateQuestionCompliance(question.localId, {
                                      min: event.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="col-md-3">
                                <label className="form-label" htmlFor={maxId}>
                                  Máximo
                                </label>
                                <input
                                  id={maxId}
                                  type="number"
                                  className="form-control"
                                  value={question.compliance.max}
                                  onChange={(event) =>
                                    updateQuestionCompliance(question.localId, {
                                      max: event.target.value,
                                    })
                                  }
                                />
                              </div>
                              {question.type === "photo" && (
                                <>
                                  <div className="col-md-3">
                                    <label
                                      className="form-label"
                                      htmlFor={minPhotosId}
                                    >
                                      Fotos mín.
                                    </label>
                                    <input
                                      id={minPhotosId}
                                      type="number"
                                      className="form-control"
                                      value={question.compliance.minPhotos}
                                      onChange={(event) =>
                                        updateQuestionCompliance(
                                          question.localId,
                                          {
                                            minPhotos: event.target.value,
                                          }
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="col-md-3">
                                    <label
                                      className="form-label"
                                      htmlFor={maxPhotosId}
                                    >
                                      Fotos máx.
                                    </label>
                                    <input
                                      id={maxPhotosId}
                                      type="number"
                                      className="form-control"
                                      value={question.compliance.maxPhotos}
                                      onChange={(event) =>
                                        updateQuestionCompliance(
                                          question.localId,
                                          {
                                            maxPhotos: event.target.value,
                                          }
                                        )
                                      }
                                    />
                                  </div>
                                </>
                              )}
                            </div>

                            <div className="form-check form-switch mt-3">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={allowPartialId}
                                checked={question.compliance.allowPartial}
                                onChange={(event) =>
                                  updateQuestionCompliance(question.localId, {
                                    allowPartial: event.target.checked,
                                  })
                                }
                              />
                              <label
                                className="form-check-label"
                                htmlFor={allowPartialId}
                              >
                                Permitir cumplimiento parcial
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
