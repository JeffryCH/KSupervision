"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import type { FormTemplateDTO, FormQuestionDTO } from "@/lib/forms";
import type { VisitLogDTO, ComplianceStatus } from "@/lib/visitLogs";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

interface StoreListItem {
  id: string;
  name: string;
  storeNumber: string;
  format: string;
  province: string;
  canton: string;
}

interface VisitLogSummary {
  compliant: number;
  partial: number;
  nonCompliant: number;
}

const STATUS_BADGES: Record<ComplianceStatus, string> = {
  compliant: "badge admin-badge admin-badge-success",
  partial: "badge admin-badge admin-badge-warning",
  non_compliant: "badge admin-badge admin-badge-danger",
};

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  compliant: "Cumple",
  partial: "Parcial",
  non_compliant: "No cumple",
};

const VISIT_STATUS_LABELS: Record<VisitLogDTO["status"], string> = {
  in_progress: "En progreso",
  submitted: "Enviado",
};

const dateFormatter = new Intl.DateTimeFormat("es-CR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatAnswerValue(value: VisitLogDTO["answers"][number]["value"]) {
  if (value === null || value === undefined) {
    return "Sin respuesta";
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "Sin selección";
    return value.join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }
  return String(value);
}

function buildSummary(log: VisitLogDTO): VisitLogSummary {
  return log.answers.reduce<VisitLogSummary>(
    (acc, answer) => {
      if (answer.complianceStatus === "compliant") acc.compliant += 1;
      if (answer.complianceStatus === "partial") acc.partial += 1;
      if (answer.complianceStatus === "non_compliant") acc.nonCompliant += 1;
      return acc;
    },
    { compliant: 0, partial: 0, nonCompliant: 0 }
  );
}

function formatStoreLabel(store: StoreListItem | null) {
  if (!store) return "Selecciona una tienda";
  return `${store.name} · ${store.storeNumber}`;
}

function getQuestionLabel(
  questionMap: Map<string, FormQuestionDTO>,
  questionId: string
) {
  return questionMap.get(questionId)?.title ?? `Pregunta ${questionId}`;
}

export default function AdminVisitLogsPage() {
  const [templates, setTemplates] = useState<FormTemplateDTO[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const [storeQuery, setStoreQuery] = useState("");
  const [storeResults, setStoreResults] = useState<StoreListItem[]>([]);
  const [isSearchingStore, setIsSearchingStore] = useState(false);
  const [storeSearchError, setStoreSearchError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<StoreListItem | null>(
    null
  );

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const selectedTemplate = useMemo(
    () =>
      templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const questionMap = useMemo(() => {
    return new Map(
      (selectedTemplate?.questions ?? []).map((question) => [
        question.id,
        question,
      ])
    );
  }, [selectedTemplate]);

  const [logs, setLogs] = useState<VisitLogDTO[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadTemplates() {
      try {
        setIsLoadingTemplates(true);
        setTemplatesError(null);
        const response = await fetch("/api/form-templates?status=published");
        const data = (await response.json()) as ApiResponse<FormTemplateDTO[]>;
        if (!response.ok || !data.success || !data.data) {
          throw new Error(
            data.message ?? "No se pudieron cargar las plantillas"
          );
        }
        if (!ignore) {
          setTemplates(data.data);
        }
      } catch (error) {
        console.error(error);
        if (!ignore) {
          setTemplatesError(
            error instanceof Error
              ? error.message
              : "Ocurrió un error al cargar las plantillas"
          );
        }
      } finally {
        if (!ignore) {
          setIsLoadingTemplates(false);
        }
      }
    }

    loadTemplates();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const query = storeQuery.trim();
    if (query.length < 3) {
      setStoreResults([]);
      setStoreSearchError(null);
      return;
    }

    const controller = new AbortController();
    async function searchStores() {
      try {
        setIsSearchingStore(true);
        setStoreSearchError(null);
        const response = await fetch(
          `/api/stores?search=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        const data = (await response.json()) as ApiResponse<StoreListItem[]>;
        if (!response.ok || !data.success || !data.data) {
          throw new Error(data.message ?? "No se pudieron buscar las tiendas");
        }
        setStoreResults(data.data.slice(0, 10));
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        setStoreSearchError(
          error instanceof Error
            ? error.message
            : "Ocurrió un error al buscar tiendas"
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingStore(false);
        }
      }
    }

    searchStores();
    return () => controller.abort();
  }, [storeQuery]);

  useEffect(() => {
    const storeId = selectedStore?.id ?? "";
    const templateId = selectedTemplate?.id ?? "";

    if (!storeId || !templateId) {
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
          storeId,
          formTemplateId: templateId,
          limit: "20",
        });
        const response = await fetch(`/api/visit-logs?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as ApiResponse<VisitLogDTO[]>;
        if (!response.ok || !data.success || !data.data) {
          throw new Error(
            data.message ?? "No se pudieron cargar las bitácoras"
          );
        }
        setLogs(data.data);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        setLogsError(
          error instanceof Error
            ? error.message
            : "Ocurrió un error al cargar las bitácoras"
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingLogs(false);
        }
      }
    }

    loadLogs();
    return () => controller.abort();
  }, [selectedStore, selectedTemplate]);

  const summary = useMemo(() => {
    return logs.map((log) => ({
      id: log.id,
      visitDate: log.visitDate,
      status: log.status,
      complianceScore: log.complianceScore,
      counts: buildSummary(log),
    }));
  }, [logs]);

  return (
    <AdminGuard>
      <main className="admin-dashboard-wrapper">
        <div className="container">
          <section className="admin-dashboard-hero mb-5">
            <div className="d-inline-flex align-items-center gap-2 mb-3 px-3 py-2 rounded-pill bg-gradient">
              <span className="auth-badge mb-0">Bitácoras de visitas</span>
            </div>
            <h1 className="display-5 fw-bold mb-3">
              Seguimiento de formularios y cumplimiento
            </h1>
            <p className="lead text-muted mb-0">
              Consulta los formularios completados por tienda y plantilla,
              revisa los puntajes de cumplimiento y analiza los cambios
              registrados en cada visita.
            </p>
          </section>

          <section className="card admin-card border-0 mb-4">
            <div className="card-body p-4 p-lg-5">
              <div className="row g-4 align-items-end">
                <div className="col-md-6">
                  <label
                    htmlFor="storeSearch"
                    className="form-label fw-semibold"
                  >
                    Buscar tienda
                  </label>
                  <input
                    id="storeSearch"
                    type="search"
                    className="form-control"
                    placeholder="Ingresa al menos 3 caracteres"
                    value={storeQuery}
                    onChange={(event) => setStoreQuery(event.target.value)}
                  />
                  <div className="mt-2 small text-muted">
                    {selectedStore ? (
                      <>
                        Tienda seleccionada: {formatStoreLabel(selectedStore)}
                      </>
                    ) : (
                      <>No hay tienda seleccionada.</>
                    )}
                  </div>
                  {storeSearchError && (
                    <div
                      className="alert admin-alert alert-danger mt-3"
                      role="alert"
                    >
                      {storeSearchError}
                    </div>
                  )}
                  {isSearchingStore && (
                    <div className="text-muted small mt-2">
                      Buscando tiendas…
                    </div>
                  )}
                  {!isSearchingStore && storeResults.length > 0 && (
                    <ul className="list-group mt-3">
                      {storeResults.map((store) => (
                        <li
                          key={store.id}
                          className={`list-group-item p-0 ${
                            selectedStore?.id === store.id ? "active" : ""
                          }`}
                        >
                          <button
                            type="button"
                            className="btn btn-link w-100 text-start px-3 py-2 text-decoration-none"
                            onClick={() => setSelectedStore(store)}
                          >
                            <div className="fw-semibold text-body">
                              {store.name}
                            </div>
                            <div className="small text-muted">
                              #{store.storeNumber} · {store.format} ·{" "}
                              {store.province} / {store.canton}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="col-md-6">
                  <label
                    htmlFor="templateSelect"
                    className="form-label fw-semibold"
                  >
                    Plantilla de bitácora
                  </label>
                  <select
                    id="templateSelect"
                    className="form-select"
                    value={selectedTemplateId}
                    onChange={(event) =>
                      setSelectedTemplateId(event.target.value)
                    }
                    disabled={isLoadingTemplates}
                  >
                    <option value="">Selecciona una plantilla publicada</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} · v{template.version}
                      </option>
                    ))}
                  </select>
                  {isLoadingTemplates && (
                    <div className="text-muted small mt-2">
                      Cargando plantillas…
                    </div>
                  )}
                  {templatesError && (
                    <div
                      className="alert admin-alert alert-danger mt-3"
                      role="alert"
                    >
                      {templatesError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="card admin-card border-0">
            <div className="card-body p-4 p-lg-5">
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                  <h2 className="h4 mb-1">Historial de visitas</h2>
                  <p className="text-muted mb-0">
                    {selectedStore && selectedTemplate
                      ? `Mostrando registros para ${
                          selectedTemplate.name
                        } en ${formatStoreLabel(selectedStore)}`
                      : "Selecciona una tienda y una plantilla para visualizar resultados."}
                  </p>
                </div>
                {selectedStore && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      setSelectedStore(null);
                      setStoreQuery("");
                      setStoreResults([]);
                    }}
                  >
                    Limpiar selección
                  </button>
                )}
              </div>

              {isLoadingLogs && (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Cargando bitácoras…</span>
                  </div>
                </div>
              )}

              {!isLoadingLogs && logsError && (
                <div className="alert admin-alert alert-danger" role="alert">
                  {logsError}
                </div>
              )}

              {!isLoadingLogs &&
                !logsError &&
                logs.length === 0 &&
                selectedStore &&
                selectedTemplate && (
                  <div className="alert admin-alert alert-info" role="alert">
                    No se encontraron registros para la combinación
                    seleccionada.
                  </div>
                )}

              {!isLoadingLogs && !logsError && logs.length > 0 && (
                <div className="visit-log-results">
                  {logs.map((log) => {
                    const logSummary = summary.find(
                      (item) => item.id === log.id
                    );
                    return (
                      <details
                        key={log.id}
                        className="visit-log-card mb-3"
                        open
                      >
                        <summary className="d-flex flex-column flex-lg-row gap-3 align-items-lg-center justify-content-lg-between">
                          <div>
                            <div className="fw-semibold">
                              {dateFormatter.format(new Date(log.visitDate))}
                            </div>
                            <div className="text-muted small">
                              Estado: {VISIT_STATUS_LABELS[log.status]}
                            </div>
                          </div>
                          <div className="d-flex flex-wrap align-items-center gap-2">
                            <span className="badge admin-badge admin-badge-primary">
                              Puntaje: {log.complianceScore.toFixed(2)}%
                            </span>
                            {logSummary && (
                              <div className="d-flex align-items-center gap-2">
                                <span className="badge admin-badge admin-badge-success">
                                  ✅ {logSummary.counts.compliant}
                                </span>
                                <span className="badge admin-badge admin-badge-warning">
                                  ⚠️ {logSummary.counts.partial}
                                </span>
                                <span className="badge admin-badge admin-badge-danger">
                                  ❌ {logSummary.counts.nonCompliant}
                                </span>
                              </div>
                            )}
                          </div>
                        </summary>
                        <div className="mt-3">
                          <div className="table-responsive">
                            <table className="table table-sm align-middle mb-0">
                              <thead>
                                <tr>
                                  <th scope="col">Pregunta</th>
                                  <th scope="col" className="text-nowrap">
                                    Estado
                                  </th>
                                  <th scope="col">Respuesta</th>
                                  <th scope="col" className="text-nowrap">
                                    Adjuntos
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {log.answers.map((answer) => (
                                  <tr key={answer.questionId}>
                                    <td>
                                      {getQuestionLabel(
                                        questionMap,
                                        answer.questionId
                                      )}
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
                                    <td>
                                      {answer.attachments.length > 0 ? (
                                        <span className="badge admin-badge admin-badge-neutral">
                                          {answer.attachments.length} archivo(s)
                                        </span>
                                      ) : (
                                        <span className="text-muted">
                                          Sin adjuntos
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
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
    </AdminGuard>
  );
}
