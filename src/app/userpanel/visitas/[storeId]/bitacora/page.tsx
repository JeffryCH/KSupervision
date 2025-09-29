"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { FormTemplateDTO, FormQuestionDTO } from "@/lib/forms";
import type {
  VisitLogDTO,
  ComplianceStatus,
  VisitAnswerInput,
} from "@/lib/visitLogs";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

interface StoreDetail {
  id: string;
  name: string;
  storeNumber: string;
  format: string;
  province: string;
  canton: string;
  location?: {
    address?: string | null;
  };
}

const STATUS_BADGES: Record<ComplianceStatus, string> = {
  compliant: "badge admin-badge admin-badge-success rounded-pill",
  partial: "badge admin-badge admin-badge-warning rounded-pill",
  non_compliant: "badge admin-badge admin-badge-danger rounded-pill",
};

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  compliant: "Cumple",
  partial: "Parcial",
  non_compliant: "No cumple",
};

const VISIT_STATUS_LABELS: Record<VisitLogDTO["status"], string> = {
  in_progress: "En progreso",
  submitted: "Enviada",
};

const dateFormatter = new Intl.DateTimeFormat("es-CR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatLocation(store: StoreDetail | null) {
  if (!store) return "";
  return [store.province, store.canton].filter(Boolean).join(" · ");
}

function formatAnswerValue(value: VisitLogDTO["answers"][number]["value"]) {
  if (value === null || value === undefined) return "Sin respuesta";
  if (Array.isArray(value)) {
    if (value.length === 0) return "Sin selección";
    return value.join(", ");
  }
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

function summarize(log: VisitLogDTO) {
  return log.answers.reduce(
    (acc, answer) => {
      acc[answer.complianceStatus] += 1;
      return acc;
    },
    { compliant: 0, partial: 0, non_compliant: 0 } as Record<
      ComplianceStatus,
      number
    >
  );
}

type AnswerValue = string | string[] | boolean | number | null;

interface AnswerState {
  value: AnswerValue;
  attachments: string[];
}

function getDefaultAnswerState(question: FormQuestionDTO): AnswerState {
  if (question.type === "multi_select") {
    return { value: [], attachments: [] } satisfies AnswerState;
  }
  if (question.type === "yes_no") {
    return { value: null, attachments: [] } satisfies AnswerState;
  }
  if (question.type === "photo") {
    return { value: "", attachments: [""] } satisfies AnswerState;
  }
  return { value: "", attachments: [] } satisfies AnswerState;
}

function buildInitialFormState(template: FormTemplateDTO | null) {
  const state: Record<string, AnswerState> = {};
  if (!template) {
    return state;
  }

  template.questions
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((question) => {
      state[question.id] = getDefaultAnswerState(question);
    });

  return state;
}

function hasProvidedValue(value: AnswerValue, attachments: string[]) {
  if (attachments.length > 0) {
    return true;
  }

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

function formatDateForInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function VisitLogHistoryPage() {
  const params = useParams<{ storeId: string }>();
  const router = useRouter();
  const storeId = params?.storeId ?? "";

  const [store, setStore] = useState<StoreDetail | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [isLoadingStore, setIsLoadingStore] = useState(true);

  const [template, setTemplate] = useState<FormTemplateDTO | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);

  const [logs, setLogs] = useState<VisitLogDTO[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [formState, setFormState] = useState<Record<string, AnswerState>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visitDate, setVisitDate] = useState(() =>
    formatDateForInput(new Date())
  );
  const [visitStatus, setVisitStatus] =
    useState<VisitLogDTO["status"]>("submitted");

  const orderedQuestions = useMemo(() => {
    return (template?.questions ?? [])
      .slice()
      .sort((a, b) => a.order - b.order);
  }, [template]);

  const initialFormState = useMemo(
    () => buildInitialFormState(template),
    [template]
  );

  useEffect(() => {
    setFormState(initialFormState);
    setFieldErrors({});
    setSubmitError(null);
    setSubmitSuccess(null);
    setVisitDate(formatDateForInput(new Date()));
    setVisitStatus("submitted");
  }, [initialFormState]);

  useEffect(() => {
    if (!storeId) {
      setStoreError("No se pudo identificar la tienda seleccionada");
      setIsLoadingStore(false);
      return;
    }

    let ignore = false;
    async function loadStore() {
      try {
        setIsLoadingStore(true);
        const response = await fetch(`/api/stores/${storeId}`);
        const data = (await response.json()) as ApiResponse<StoreDetail>;
        if (!response.ok || !data.success || !data.data) {
          throw new Error(data.message ?? "No se pudo cargar la tienda");
        }
        if (!ignore) {
          setStore(data.data);
        }
      } catch (error) {
        console.error(error);
        if (!ignore) {
          setStoreError(
            error instanceof Error
              ? error.message
              : "Ocurrió un error al cargar la tienda"
          );
        }
      } finally {
        if (!ignore) {
          setIsLoadingStore(false);
        }
      }
    }

    loadStore();
    return () => {
      ignore = true;
    };
  }, [storeId]);

  useEffect(() => {
    if (!store) {
      setTemplate(null);
      return;
    }

    const controller = new AbortController();
    async function loadTemplate(current: StoreDetail) {
      try {
        setIsLoadingTemplate(true);
        setTemplateError(null);
        const { id: storeIdValue, format } = current;
        const params = new URLSearchParams({ storeId: storeIdValue });
        if (format) {
          params.set("format", format);
        }
        const response = await fetch(`/api/forms/active?${params.toString()}`, {
          signal: controller.signal,
        });
        const data =
          (await response.json()) as ApiResponse<FormTemplateDTO | null>;
        if (!response.ok || !data.success) {
          throw new Error(
            data.message ?? "No se pudo obtener la bitácora activa"
          );
        }
        setTemplate(data.data ?? null);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        setTemplateError(
          error instanceof Error
            ? error.message
            : "Ocurrió un error al cargar la plantilla"
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingTemplate(false);
        }
      }
    }

    loadTemplate(store);
    return () => controller.abort();
  }, [store]);

  useEffect(() => {
    const templateId = template?.id ?? "";
    const storeIdValue = store?.id ?? "";
    if (!storeIdValue || !templateId) {
      setLogs([]);
      setLogsError(null);
      return;
    }

    const controller = new AbortController();
    async function loadLogs() {
      try {
        setIsLoadingLogs(true);
        setLogsError(null);
        const params = new URLSearchParams({
          storeId: storeIdValue,
          formTemplateId: templateId,
          limit: "10",
        });
        const response = await fetch(`/api/visit-logs?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as ApiResponse<VisitLogDTO[]>;
        if (!response.ok || !data.success || !data.data) {
          throw new Error(data.message ?? "No se pudo obtener el historial");
        }
        setLogs(data.data);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        setLogsError(
          error instanceof Error
            ? error.message
            : "Ocurrió un error al obtener el historial"
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingLogs(false);
        }
      }
    }

    loadLogs();
    return () => controller.abort();
  }, [store, template]);

  const questionMap = useMemo(() => {
    return new Map(orderedQuestions.map((question) => [question.id, question]));
  }, [orderedQuestions]);

  const summaries = useMemo(() => {
    return logs.map((log) => ({ id: log.id, counts: summarize(log) }));
  }, [logs]);

  const resetForm = () => {
    if (!template) {
      setFormState({});
      setFieldErrors({});
      setSubmitError(null);
      setVisitDate(new Date().toISOString().slice(0, 16));
      return;
    }
    setFormState(buildInitialFormState(template));
    setFieldErrors({});
    setSubmitError(null);
    setVisitDate(formatDateForInput(new Date()));
  };

  const updateAnswerState = (
    questionId: string,
    updater: (prev: AnswerState) => AnswerState
  ) => {
    setFormState((prev) => {
      const question = questionMap.get(questionId);
      const current =
        prev[questionId] ??
        (question
          ? getDefaultAnswerState(question)
          : { value: "", attachments: [] });
      return {
        ...prev,
        [questionId]: updater(current),
      } satisfies Record<string, AnswerState>;
    });
    setFieldErrors((prev) => {
      if (!prev[questionId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    setSubmitSuccess(null);
  };

  const handleTextChange = (questionId: string, value: string) => {
    updateAnswerState(questionId, (prev) => ({ ...prev, value }));
  };

  const handleYesNoChange = (questionId: string, value: boolean) => {
    updateAnswerState(questionId, (prev) => ({ ...prev, value }));
  };

  const handleNumberChange = (questionId: string, value: string) => {
    updateAnswerState(questionId, (prev) => ({ ...prev, value }));
  };

  const handleSelectChange = (questionId: string, value: string) => {
    updateAnswerState(questionId, (prev) => ({ ...prev, value }));
  };

  const handleMultiSelectToggle = (
    questionId: string,
    optionValue: string,
    checked: boolean
  ) => {
    updateAnswerState(questionId, (prev) => {
      const currentValues = Array.isArray(prev.value) ? [...prev.value] : [];
      if (checked) {
        if (!currentValues.includes(optionValue)) {
          currentValues.push(optionValue);
        }
      } else {
        const index = currentValues.indexOf(optionValue);
        if (index !== -1) {
          currentValues.splice(index, 1);
        }
      }
      return {
        ...prev,
        value: currentValues,
      } satisfies AnswerState;
    });
  };

  const handleAttachmentChange = (
    questionId: string,
    index: number,
    value: string
  ) => {
    updateAnswerState(questionId, (prev) => {
      const attachments = [...prev.attachments];
      attachments[index] = value;
      return { ...prev, attachments } satisfies AnswerState;
    });
  };

  const handleAddAttachment = (questionId: string) => {
    updateAnswerState(questionId, (prev) => ({
      ...prev,
      attachments: [...prev.attachments, ""],
    }));
  };

  const handleRemoveAttachment = (questionId: string, index: number) => {
    updateAnswerState(questionId, (prev) => {
      const attachments = prev.attachments.filter((_, idx) => idx !== index);
      return { ...prev, attachments } satisfies AnswerState;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!store || !template) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    const newErrors: Record<string, string> = {};
    const answers: VisitAnswerInput[] = [];

    orderedQuestions.forEach((question) => {
      const state = formState[question.id] ?? getDefaultAnswerState(question);
      const attachments = state.attachments
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      let normalizedValue: VisitAnswerInput["value"] = null;

      switch (question.type) {
        case "yes_no": {
          normalizedValue =
            typeof state.value === "boolean" ? state.value : null;
          break;
        }
        case "number": {
          const rawString =
            typeof state.value === "string"
              ? state.value
              : state.value === null || state.value === undefined
              ? ""
              : String(state.value);
          if (rawString.trim().length === 0) {
            normalizedValue = null;
          } else {
            const parsed = Number(rawString);
            if (Number.isNaN(parsed)) {
              newErrors[question.id] = "Ingresa un número válido";
            } else {
              normalizedValue = parsed;
              if (
                typeof question.config.min === "number" &&
                parsed < question.config.min
              ) {
                newErrors[question.id] =
                  newErrors[question.id] ??
                  `El valor debe ser mayor o igual a ${question.config.min}`;
              }
              if (
                typeof question.config.max === "number" &&
                parsed > question.config.max
              ) {
                newErrors[question.id] =
                  newErrors[question.id] ??
                  `El valor debe ser menor o igual a ${question.config.max}`;
              }
            }
          }
          break;
        }
        case "select": {
          const rawValue =
            typeof state.value === "string" ? state.value.trim() : "";
          if (!rawValue) {
            normalizedValue = null;
          } else if (
            !question.options.some((option) => option.value === rawValue)
          ) {
            newErrors[question.id] = "Selecciona una opción válida";
            normalizedValue = null;
          } else {
            normalizedValue = rawValue;
          }
          break;
        }
        case "multi_select": {
          const selected = Array.isArray(state.value)
            ? state.value.map((item) => String(item))
            : [];
          const validValues = new Set(
            question.options.map((option) => option.value)
          );
          const filtered = Array.from(
            new Set(selected.filter((item) => validValues.has(item)))
          );
          if (selected.length && filtered.length !== selected.length) {
            newErrors[question.id] = "Selecciona opciones válidas";
          }
          normalizedValue = filtered;
          break;
        }
        case "photo": {
          const comment =
            typeof state.value === "string" ? state.value.trim() : "";
          normalizedValue = comment.length ? comment : null;

          const minPhotos = question.config.minPhotos ?? 0;
          const maxPhotos =
            typeof question.config.maxPhotos === "number"
              ? question.config.maxPhotos
              : null;

          if (question.required && attachments.length === 0) {
            newErrors[question.id] = "Agrega al menos una fotografía";
          }

          if (
            minPhotos > 0 &&
            attachments.length > 0 &&
            attachments.length < minPhotos
          ) {
            newErrors[question.id] =
              newErrors[question.id] ??
              `Debes adjuntar al menos ${minPhotos} foto${
                minPhotos === 1 ? "" : "s"
              }`;
          }

          if (maxPhotos !== null && attachments.length > maxPhotos) {
            newErrors[question.id] =
              newErrors[question.id] ??
              `Solo puedes adjuntar hasta ${maxPhotos} foto${
                maxPhotos === 1 ? "" : "s"
              }`;
          }
          break;
        }
        default: {
          const rawValue =
            typeof state.value === "string" ? state.value.trim() : "";
          normalizedValue = rawValue.length ? rawValue : null;
          break;
        }
      }

      const hasValue = hasProvidedValue(normalizedValue, attachments);
      if (question.required && !hasValue) {
        newErrors[question.id] =
          newErrors[question.id] ?? "Esta pregunta es obligatoria";
      }

      if (hasValue) {
        const answer: VisitAnswerInput = {
          questionId: question.id,
          value: Array.isArray(normalizedValue)
            ? normalizedValue
            : normalizedValue,
        };
        if (attachments.length > 0) {
          answer.attachments = attachments;
        }
        answers.push(answer);
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setSubmitError("Revisa las respuestas marcadas en rojo");
      setIsSubmitting(false);
      return;
    }

    setFieldErrors({});

    if (answers.length === 0) {
      setSubmitError("Debes responder al menos una pregunta antes de enviar");
      setIsSubmitting(false);
      return;
    }

    let normalizedVisitDate = new Date().toISOString();
    if (visitDate) {
      const parsed = new Date(visitDate);
      if (Number.isNaN(parsed.getTime())) {
        setSubmitError("Selecciona una fecha y hora válidas");
        setIsSubmitting(false);
        return;
      }
      normalizedVisitDate = parsed.toISOString();
    }

    try {
      const response = await fetch("/api/visit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: store.id,
          formTemplateId: template.id,
          visitDate: normalizedVisitDate,
          status: visitStatus,
          answers,
        }),
      });

      const data = (await response.json()) as ApiResponse<VisitLogDTO>;
      if (!response.ok || !data.success || !data.data) {
        throw new Error(
          data.message ?? "No se pudo registrar la bitácora de la visita"
        );
      }

      const createdLog = data.data;
      setLogs((prev) => [createdLog, ...prev]);
      setSubmitSuccess("¡Bitácora registrada correctamente!");
      resetForm();
    } catch (error) {
      console.error(error);
      setSubmitError(
        error instanceof Error
          ? error.message
          : "No se pudo registrar la bitácora"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestionField = (question: FormQuestionDTO) => {
    const state = formState[question.id] ?? getDefaultAnswerState(question);
    const error = fieldErrors[question.id];
    const baseId = `question-${question.id}`;
    const descriptionId = question.description
      ? `${baseId}-description`
      : undefined;
    const describedBy = descriptionId
      ? { "aria-describedby": descriptionId }
      : {};

    const labelForId = (() => {
      if (question.type === "yes_no") {
        return `${baseId}-yes`;
      }
      if (question.type === "multi_select" && question.options[0]) {
        return `${baseId}-${question.options[0].id}`;
      }
      if (question.type === "photo") {
        return `${baseId}-comment`;
      }
      return baseId;
    })();

    const helperNotes: string[] = [];
    if (question.type === "number") {
      const ranges: string[] = [];
      if (typeof question.config.min === "number") {
        ranges.push(`mínimo ${question.config.min}`);
      }
      if (typeof question.config.max === "number") {
        ranges.push(`máximo ${question.config.max}`);
      }
      if (ranges.length > 0) {
        helperNotes.push(`Rango permitido: ${ranges.join(" y ")}`);
      }
    }

    if (question.type === "photo") {
      const minPhotos = question.config.minPhotos ?? 0;
      const maxPhotos =
        typeof question.config.maxPhotos === "number"
          ? question.config.maxPhotos
          : null;
      if (minPhotos > 0 || maxPhotos !== null) {
        const parts: string[] = [];
        if (minPhotos > 0) {
          parts.push(`mínimo ${minPhotos}`);
        }
        if (maxPhotos !== null) {
          parts.push(`máximo ${maxPhotos}`);
        }
        helperNotes.push(`Adjunta ${parts.join(" y ")} fotos.`);
      }
    }

    if (question.config.expectedValue !== undefined) {
      const expected = question.config.expectedValue;
      let expectedLabel: string | null = null;
      if (Array.isArray(expected)) {
        expectedLabel = expected.join(", ");
      } else if (typeof expected === "boolean") {
        expectedLabel = expected ? "Sí" : "No";
      } else if (expected !== null) {
        expectedLabel = String(expected);
      }
      if (expectedLabel) {
        helperNotes.push(`Valor esperado: ${expectedLabel}`);
      }
    }

    let control: ReactNode = null;

    switch (question.type) {
      case "short_text": {
        control = (
          <input
            id={baseId}
            type="text"
            className={`form-control${error ? " is-invalid" : ""}`}
            value={typeof state.value === "string" ? state.value : ""}
            onChange={(event) =>
              handleTextChange(question.id, event.target.value)
            }
            {...describedBy}
          />
        );
        break;
      }
      case "long_text": {
        control = (
          <textarea
            id={`${baseId}-textarea`}
            className={`form-control${error ? " is-invalid" : ""}`}
            rows={3}
            value={typeof state.value === "string" ? state.value : ""}
            onChange={(event) =>
              handleTextChange(question.id, event.target.value)
            }
            {...describedBy}
          />
        );
        break;
      }
      case "yes_no": {
        control = (
          <div className="d-flex gap-3">
            <div className="form-check">
              <input
                className={`form-check-input${error ? " is-invalid" : ""}`}
                type="radio"
                name={baseId}
                id={`${baseId}-yes`}
                checked={state.value === true}
                onChange={() => handleYesNoChange(question.id, true)}
              />
              <label className="form-check-label" htmlFor={`${baseId}-yes`}>
                Sí
              </label>
            </div>
            <div className="form-check">
              <input
                className={`form-check-input${error ? " is-invalid" : ""}`}
                type="radio"
                name={baseId}
                id={`${baseId}-no`}
                checked={state.value === false}
                onChange={() => handleYesNoChange(question.id, false)}
              />
              <label className="form-check-label" htmlFor={`${baseId}-no`}>
                No
              </label>
            </div>
          </div>
        );
        break;
      }
      case "number": {
        const numericValue =
          typeof state.value === "number"
            ? String(state.value)
            : typeof state.value === "string"
            ? state.value
            : "";
        control = (
          <input
            id={`${baseId}-number`}
            type="number"
            className={`form-control${error ? " is-invalid" : ""}`}
            value={numericValue}
            onChange={(event) =>
              handleNumberChange(question.id, event.target.value)
            }
            {...describedBy}
          />
        );
        break;
      }
      case "select": {
        const currentValue = typeof state.value === "string" ? state.value : "";
        control = (
          <select
            id={`${baseId}-select`}
            className={`form-select${error ? " is-invalid" : ""}`}
            value={currentValue}
            onChange={(event) =>
              handleSelectChange(question.id, event.target.value)
            }
            {...describedBy}
          >
            <option value="">Selecciona una opción</option>
            {question.options.map((option) => (
              <option key={option.id} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
        break;
      }
      case "multi_select": {
        const selectedValues = Array.isArray(state.value) ? state.value : [];
        control = (
          <div className="d-flex flex-column gap-2">
            {question.options.map((option) => {
              const inputId = `${baseId}-${option.id}`;
              const checked = selectedValues.includes(option.value);
              return (
                <div className="form-check" key={option.id}>
                  <input
                    className={`form-check-input${error ? " is-invalid" : ""}`}
                    type="checkbox"
                    id={inputId}
                    checked={checked}
                    onChange={(event) =>
                      handleMultiSelectToggle(
                        question.id,
                        option.value,
                        event.target.checked
                      )
                    }
                  />
                  <label className="form-check-label" htmlFor={inputId}>
                    {option.label}
                  </label>
                </div>
              );
            })}
          </div>
        );
        break;
      }
      case "photo": {
        const attachmentFields =
          state.attachments.length > 0 ? state.attachments : [""];
        control = (
          <div className="d-flex flex-column gap-3">
            <div>
              <label className="form-label" htmlFor={`${baseId}-comment`}>
                Comentario (opcional)
              </label>
              <textarea
                id={`${baseId}-comment`}
                className={`form-control${error ? " is-invalid" : ""}`}
                rows={2}
                value={typeof state.value === "string" ? state.value : ""}
                onChange={(event) =>
                  handleTextChange(question.id, event.target.value)
                }
              />
            </div>
            <div className="d-flex flex-column gap-2">
              {attachmentFields.map((attachment, index) => {
                const inputId = `${baseId}-attachment-${index}`;
                return (
                  <div
                    className="d-flex align-items-center gap-2"
                    key={inputId}
                  >
                    <input
                      id={inputId}
                      type="url"
                      placeholder="URL o referencia de la foto"
                      className={`form-control${error ? " is-invalid" : ""}`}
                      value={attachment}
                      onChange={(event) =>
                        handleAttachmentChange(
                          question.id,
                          index,
                          event.target.value
                        )
                      }
                    />
                    {attachmentFields.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-outline-danger"
                        onClick={() =>
                          handleRemoveAttachment(question.id, index)
                        }
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                );
              })}
              <div>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => handleAddAttachment(question.id)}
                >
                  Agregar fotografía
                </button>
              </div>
            </div>
          </div>
        );
        break;
      }
      default: {
        control = (
          <input
            id={baseId}
            type="text"
            className={`form-control${error ? " is-invalid" : ""}`}
            value={typeof state.value === "string" ? state.value : ""}
            onChange={(event) =>
              handleTextChange(question.id, event.target.value)
            }
            {...describedBy}
          />
        );
      }
    }

    return (
      <div key={question.id} className="mb-4">
        <div className="d-flex justify-content-between align-items-start gap-3">
          <div>
            <label className="form-label fw-semibold" htmlFor={labelForId}>
              {question.title}
              {question.required && <span className="text-danger ms-1">*</span>}
            </label>
            {question.description && (
              <p id={descriptionId} className="text-muted small mb-2">
                {question.description}
              </p>
            )}
          </div>
          <span className="badge admin-badge admin-badge-neutral text-uppercase small">
            {question.type.replace(/_/g, " ")}
          </span>
        </div>
        {control}
        {helperNotes.length > 0 && (
          <p className="text-muted small mt-2 mb-0">
            {helperNotes.join(" · ")}
          </p>
        )}
        {error && <div className="invalid-feedback d-block mt-1">{error}</div>}
      </div>
    );
  };

  const handleBack = () => {
    router.back();
  };

  const renderHeader = () => (
    <header className="mb-4">
      <button
        type="button"
        className="btn btn-outline-light mb-3"
        onClick={handleBack}
      >
        ← Volver
      </button>
      <h1 className="h3 text-white fw-bold mb-1">Bitácora de la visita</h1>
      <p className="text-muted mb-0">
        Revisa los registros completados y el puntaje de cumplimiento de cada
        visita.
      </p>
    </header>
  );

  return (
    <main className="user-panel-wrapper py-5">
      <div className="container">
        {renderHeader()}

        <section className="card shadow-sm border-0 mb-4">
          <div className="card-body p-4 p-lg-5">
            {isLoadingStore ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando tienda…</span>
                </div>
              </div>
            ) : storeError ? (
              <div className="alert admin-alert alert-danger" role="alert">
                {storeError}
              </div>
            ) : store ? (
              <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
                <div>
                  <h2 className="h4 fw-semibold mb-2 text-white">
                    {store.name}
                  </h2>
                  <p className="text-muted mb-1">#{store.storeNumber}</p>
                  <p className="text-secondary mb-1">
                    {formatLocation(store) || "Ubicación no disponible"}
                  </p>
                  {store.location?.address && (
                    <p className="text-secondary small mb-0">
                      {store.location.address}
                    </p>
                  )}
                </div>
                <div className="text-lg-end">
                  <span className="badge admin-badge admin-badge-neutral fw-semibold px-3 py-2">
                    {store.format}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="card shadow-sm border-0 mb-4">
          <div className="card-body p-4 p-lg-5">
            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-3">
              <div>
                <h2 className="h4 mb-1">Plantilla activa</h2>
                <p className="text-muted mb-0">
                  Esta es la plantilla asignada a la tienda para registrar las
                  visitas.
                </p>
              </div>
              <Link href="/userpanel" className="btn btn-outline-secondary">
                Ir al panel
              </Link>
            </div>

            {isLoadingTemplate ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando plantilla…</span>
                </div>
              </div>
            ) : templateError ? (
              <div className="alert admin-alert alert-danger" role="alert">
                {templateError}
              </div>
            ) : template ? (
              <div>
                <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
                  <div>
                    <h3 className="h5 fw-semibold mb-1">{template.name}</h3>
                    <p className="text-muted mb-0">
                      {template.description || "Sin descripción"}
                    </p>
                  </div>
                  <div className="text-lg-end">
                    <span className="badge admin-badge admin-badge-primary">
                      Versión {template.version}
                    </span>
                  </div>
                </div>
                <p className="text-secondary small mt-3 mb-0">
                  Preguntas activas: {template.questions.length}
                </p>
              </div>
            ) : (
              <div className="alert admin-alert alert-info" role="alert">
                La tienda aún no tiene una plantilla activa de bitácora
                asignada.
              </div>
            )}
          </div>
        </section>

        <section className="card shadow-sm border-0 mb-4">
          <div className="card-body p-4 p-lg-5">
            <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-3">
              <div>
                <h2 className="h4 mb-1">Registrar nueva visita</h2>
                <p className="text-muted mb-0">
                  Completa el formulario para generar un nuevo registro en la
                  bitácora de la tienda.
                </p>
              </div>
            </div>

            {isLoadingTemplate ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando formulario…</span>
                </div>
              </div>
            ) : templateError ? (
              <div className="alert admin-alert alert-danger" role="alert">
                {templateError}
              </div>
            ) : !template ? (
              <div className="alert admin-alert alert-info" role="alert">
                Necesitas una plantilla activa para poder capturar una nueva
                bitácora.
              </div>
            ) : (
              <form
                className="visit-log-form"
                onSubmit={handleSubmit}
                noValidate
              >
                <div className="row g-3 mb-4">
                  <div className="col-12 col-lg-6">
                    <label
                      htmlFor="visit-date"
                      className="form-label fw-semibold"
                    >
                      Fecha y hora de la visita
                      <span className="text-danger ms-1">*</span>
                    </label>
                    <input
                      id="visit-date"
                      type="datetime-local"
                      className="form-control"
                      value={visitDate}
                      onChange={(event) => {
                        setVisitDate(event.target.value);
                        setSubmitSuccess(null);
                      }}
                      required
                    />
                  </div>
                  <div className="col-12 col-lg-6">
                    <label
                      htmlFor="visit-status"
                      className="form-label fw-semibold"
                    >
                      Estado del registro
                    </label>
                    <select
                      id="visit-status"
                      className="form-select"
                      value={visitStatus}
                      onChange={(event) => {
                        setVisitStatus(
                          event.target.value as VisitLogDTO["status"]
                        );
                        setSubmitSuccess(null);
                      }}
                    >
                      <option value="submitted">Enviada</option>
                      <option value="in_progress">En progreso</option>
                    </select>
                  </div>
                </div>

                <div>
                  {orderedQuestions.length === 0 ? (
                    <div
                      className="alert admin-alert alert-warning"
                      role="alert"
                    >
                      La plantilla activa no tiene preguntas configuradas.
                    </div>
                  ) : (
                    orderedQuestions.map((question) =>
                      renderQuestionField(question)
                    )
                  )}
                </div>

                {submitError && (
                  <div className="alert admin-alert alert-danger" role="alert">
                    {submitError}
                  </div>
                )}
                {submitSuccess && (
                  <div className="alert admin-alert alert-success" role="alert">
                    {submitSuccess}
                  </div>
                )}

                <div className="d-flex justify-content-end mt-4">
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Enviando…" : "Enviar bitácora"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        <section className="card shadow-sm border-0">
          <div className="card-body p-4 p-lg-5">
            <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-3">
              <div>
                <h2 className="h4 mb-1">Historial de bitácoras</h2>
                <p className="text-muted mb-0">
                  Consulta el detalle de cada registro presentado durante tus
                  visitas.
                </p>
              </div>
            </div>

            {isLoadingLogs ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando historial…</span>
                </div>
              </div>
            ) : logsError ? (
              <div className="alert admin-alert alert-danger" role="alert">
                {logsError}
              </div>
            ) : logs.length === 0 ? (
              <div className="alert admin-alert alert-info" role="alert">
                Aún no se han registrado bitácoras para esta tienda.
              </div>
            ) : (
              <div className="visit-log-history">
                {logs.map((log) => {
                  const summary = summaries.find((item) => item.id === log.id);
                  return (
                    <details key={log.id} className="visit-log-entry mb-3" open>
                      <summary className="d-flex flex-column flex-lg-row gap-3 justify-content-lg-between align-items-lg-center">
                        <div>
                          <div className="fw-semibold text-white">
                            {dateFormatter.format(new Date(log.visitDate))}
                          </div>
                          <div className="text-muted small">
                            Estado: {VISIT_STATUS_LABELS[log.status]}
                          </div>
                        </div>
                        <div className="d-flex flex-wrap gap-2 align-items-center">
                          <span className="badge admin-badge admin-badge-primary rounded-pill">
                            Puntaje {log.complianceScore.toFixed(2)}%
                          </span>
                          {summary && (
                            <div className="d-flex flex-wrap gap-2">
                              <span className="badge admin-badge admin-badge-success">
                                ✅ {summary.counts.compliant}
                              </span>
                              <span className="badge admin-badge admin-badge-warning">
                                ⚠️ {summary.counts.partial}
                              </span>
                              <span className="badge admin-badge admin-badge-danger">
                                ❌ {summary.counts.non_compliant}
                              </span>
                            </div>
                          )}
                        </div>
                      </summary>
                      <div className="mt-3">
                        <div className="table-responsive">
                          <table className="table table-sm align-middle mb-0">
                            <thead className="table-light">
                              <tr>
                                <th scope="col">Pregunta</th>
                                <th scope="col" className="text-nowrap">
                                  Estado
                                </th>
                                <th scope="col">Respuesta</th>
                              </tr>
                            </thead>
                            <tbody>
                              {log.answers.map((answer) => {
                                const question = questionMap.get(
                                  answer.questionId
                                ) as FormQuestionDTO | undefined;
                                return (
                                  <tr key={answer.questionId}>
                                    <td>
                                      {question?.title ??
                                        `Pregunta ${answer.questionId}`}
                                    </td>
                                    <td>
                                      <span
                                        className={
                                          STATUS_BADGES[answer.complianceStatus]
                                        }
                                      >
                                        {STATUS_LABELS[answer.complianceStatus]}
                                      </span>
                                    </td>
                                    <td>{formatAnswerValue(answer.value)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {log.history.length > 0 && (
                          <div className="mt-3">
                            <h3 className="h6 fw-semibold mb-2">
                              Cambios registrados
                            </h3>
                            <ul className="list-group list-group-flush">
                              {log.history.map((change) => (
                                <li
                                  key={change.changedAt}
                                  className="list-group-item px-0"
                                >
                                  <div className="d-flex justify-content-between">
                                    <span className="small fw-semibold">
                                      {dateFormatter.format(
                                        new Date(change.changedAt)
                                      )}
                                    </span>
                                    {change.changedBy && (
                                      <span className="badge admin-badge admin-badge-neutral">
                                        Usuario {change.changedBy.slice(-6)}
                                      </span>
                                    )}
                                  </div>
                                  <ul className="small text-muted mt-2 mb-0 ps-4">
                                    {change.changes.map((entry) => (
                                      <li
                                        key={`${entry.questionId}-${entry.current.updatedAt}`}
                                      >
                                        Actualizada la pregunta{" "}
                                        {questionMap.get(entry.questionId)
                                          ?.title ?? entry.questionId}
                                      </li>
                                    ))}
                                  </ul>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
