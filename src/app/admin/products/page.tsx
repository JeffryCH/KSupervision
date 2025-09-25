"use client";

import {
  FormEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import BarcodeScannerOverlay from "@/components/admin/BarcodeScannerOverlay";

interface Product {
  id: string;
  name: string;
  factoryBarcode: string;
  upcCode: string;
  createdAt: string;
  updatedAt: string;
}

interface StatusMessage {
  type: "success" | "error";
  text: string;
}

interface ProductFormState {
  name: string;
  factoryBarcode: string;
  upcCode: string;
}

type ScannerTarget = "factoryBarcode" | "upcCode";

const emptyFormState: ProductFormState = {
  name: "",
  factoryBarcode: "",
  upcCode: "",
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null
  );
  const [showFormModal, setShowFormModal] = useState(false);
  const [formState, setFormState] = useState<ProductFormState>(emptyFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<ScannerTarget | null>(
    null
  );

  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const hasProducts = products.length > 0;

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      const query = params.toString();
      const response = await fetch(
        query ? `/api/products?${query}` : "/api/products"
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "No se pudieron obtener los productos");
      }

      setProducts(data.data ?? []);
    } catch (error) {
      console.error(error);
      setStatusMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al cargar los productos",
      });
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (showFormModal) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [showFormModal]);

  useEffect(() => {
    if (showFormModal && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [showFormModal]);

  const resetFormState = useCallback(() => {
    setFormState(emptyFormState);
    setEditingId(null);
  }, []);

  const closeFormModal = useCallback(() => {
    setShowFormModal(false);
    setSubmitting(false);
    resetFormState();
  }, [resetFormState]);

  function openCreateModal() {
    setStatusMessage(null);
    resetFormState();
    setShowFormModal(true);
  }

  function openEditModal(product: Product) {
    setStatusMessage(null);
    setEditingId(product.id);
    setFormState({
      name: product.name,
      factoryBarcode: product.factoryBarcode,
      upcCode: product.upcCode,
    });
    setShowFormModal(true);
  }

  function handleModalBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      closeFormModal();
    }
  }

  async function handleDelete(product: Product) {
    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar el producto ${product.name}?`
    );
    if (!confirmed) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/products/${product.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "No se pudo eliminar el producto");
      }

      setStatusMessage({
        type: "success",
        text: "Producto eliminado correctamente",
      });
      await fetchProducts();
    } catch (error) {
      console.error(error);
      setStatusMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al eliminar el producto",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function sanitizeBarcode(value: string) {
    return value
      .replace(/\s+/g, "")
      .replace(/[^0-9A-Za-z]/g, "")
      .toUpperCase();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = formState.name.trim();
    const factoryBarcode = sanitizeBarcode(formState.factoryBarcode);
    const upcCode = sanitizeBarcode(formState.upcCode);

    if (!name || !factoryBarcode || !upcCode) {
      setStatusMessage({
        type: "error",
        text: "Todos los campos son obligatorios y los códigos deben contener caracteres válidos",
      });
      return;
    }

    const payload = {
      name,
      factoryBarcode,
      upcCode,
    };

    try {
      setSubmitting(true);
      const response = await fetch(
        editingId ? `/api/products/${editingId}` : "/api/products",
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ??
            (editingId
              ? "No se pudo actualizar el producto"
              : "No se pudo crear el producto")
        );
      }

      setStatusMessage({
        type: "success",
        text: editingId
          ? "Producto actualizado correctamente"
          : "Producto creado correctamente",
      });

      closeFormModal();
      await fetchProducts();
    } catch (error) {
      console.error(error);
      setStatusMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al guardar el producto",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleScannerOpen(target: ScannerTarget) {
    setScannerTarget(target);
    setShowScanner(true);
  }

  function handleScannerClose() {
    setShowScanner(false);
    setScannerTarget(null);
  }

  function handleScannerDetected(value: string) {
    const normalized = sanitizeBarcode(value);
    if (!normalized) {
      return;
    }

    setFormState((prev) => {
      if (!scannerTarget) {
        return prev;
      }

      if (scannerTarget === "factoryBarcode") {
        return { ...prev, factoryBarcode: normalized };
      }

      return { ...prev, upcCode: normalized };
    });

    setStatusMessage({
      type: "success",
      text: "Código escaneado correctamente",
    });

    setScannerTarget(null);
    setShowScanner(false);
  }

  function formatDate(value: string) {
    if (!value) return "";
    try {
      return new Intl.DateTimeFormat("es-CR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    } catch (error) {
      console.error("Error al formatear fecha:", error);
      return value;
    }
  }

  return (
    <main className="admin-users-wrapper">
      <div className="container py-5">
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
          <div>
            <h1 className="display-6 fw-bold text-white mb-2">
              Gestión de productos
            </h1>
            <p className="text-muted mb-0">
              Registra productos y automatiza la captura de códigos de barras
              usando la cámara del dispositivo.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={openCreateModal}
          >
            Nuevo producto
          </button>
        </div>

        {statusMessage && (
          <div
            className={`alert alert-${
              statusMessage.type === "success" ? "success" : "danger"
            } mb-4`}
            role="alert"
          >
            {statusMessage.text}
          </div>
        )}

        <section>
          <div className="card admin-card shadow-sm border-0">
            <div className="card-body">
              <div className="d-flex flex-wrap gap-3 justify-content-between align-items-center mb-4">
                <div>
                  <h2 className="h4 mb-1">Listado de productos</h2>
                  <p className="text-muted mb-0">
                    {loading
                      ? "Cargando productos..."
                      : hasProducts
                      ? `${products.length} resultado(s)`
                      : "No hay productos registrados"}
                  </p>
                </div>

                <div className="d-flex flex-wrap gap-2">
                  <input
                    type="search"
                    className="form-control admin-filter-search"
                    placeholder="Buscar por nombre o código"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-light"
                    onClick={() => void fetchProducts()}
                    disabled={loading}
                  >
                    Buscar
                  </button>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-dark table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Nombre</th>
                      <th scope="col">Cód. fábrica</th>
                      <th scope="col">Cód. UPC</th>
                      <th scope="col">Actualizado</th>
                      <th scope="col" className="text-end">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-4">
                          Cargando...
                        </td>
                      </tr>
                    ) : hasProducts ? (
                      products.map((product, index) => (
                        <tr key={product.id}>
                          <th scope="row">{index + 1}</th>
                          <td className="fw-semibold">{product.name}</td>
                          <td>
                            <code>{product.factoryBarcode}</code>
                          </td>
                          <td>
                            <code>{product.upcCode}</code>
                          </td>
                          <td className="text-muted small">
                            {formatDate(product.updatedAt)}
                          </td>
                          <td className="text-end">
                            <div className="btn-group" role="group">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-light"
                                onClick={() => openEditModal(product)}
                                disabled={submitting}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => void handleDelete(product)}
                                disabled={submitting}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-4">
                          No hay productos registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {showFormModal && (
          <>
            <div
              className="modal fade show d-block admin-modal"
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="productFormModalTitle"
              onClick={handleModalBackdropClick}
            >
              <div
                className="modal-dialog modal-lg modal-dialog-centered admin-modal-dialog"
                role="document"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="modal-content admin-modal-content admin-card">
                  <div className="modal-header">
                    <h5 className="modal-title" id="productFormModalTitle">
                      {editingId ? "Editar producto" : "Registrar producto"}
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Cerrar"
                      onClick={closeFormModal}
                      disabled={submitting}
                    />
                  </div>
                  <form onSubmit={handleSubmit} noValidate>
                    <div className="modal-body">
                      <div className="row g-3">
                        <div className="col-12">
                          <label htmlFor="product-name" className="form-label">
                            Nombre del producto
                          </label>
                          <input
                            id="product-name"
                            className="form-control"
                            value={formState.name}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                name: event.target.value,
                              }))
                            }
                            ref={nameInputRef}
                            required
                          />
                        </div>

                        <div className="col-md-6">
                          <label
                            htmlFor="product-factory-barcode"
                            className="form-label"
                          >
                            Código de barras (fábrica)
                          </label>
                          <div className="input-group">
                            <input
                              id="product-factory-barcode"
                              className="form-control"
                              value={formState.factoryBarcode}
                              onChange={(event) =>
                                setFormState((prev) => ({
                                  ...prev,
                                  factoryBarcode: event.target.value,
                                }))
                              }
                              required
                            />
                            <button
                              type="button"
                              className="btn btn-outline-primary"
                              onClick={() =>
                                handleScannerOpen("factoryBarcode")
                              }
                            >
                              Escanear
                            </button>
                          </div>
                          <p className="form-text text-muted">
                            Puedes escribir manualmente o usar la cámara para
                            capturar el código directamente.
                          </p>
                        </div>

                        <div className="col-md-6">
                          <label
                            htmlFor="product-upc-code"
                            className="form-label"
                          >
                            Código UPC (tienda)
                          </label>
                          <div className="input-group">
                            <input
                              id="product-upc-code"
                              className="form-control"
                              value={formState.upcCode}
                              onChange={(event) =>
                                setFormState((prev) => ({
                                  ...prev,
                                  upcCode: event.target.value,
                                }))
                              }
                              required
                            />
                            <button
                              type="button"
                              className="btn btn-outline-primary"
                              onClick={() => handleScannerOpen("upcCode")}
                            >
                              Escanear
                            </button>
                          </div>
                          <p className="form-text text-muted">
                            Utiliza la cámara frontal para capturar el código
                            UPC generado en la tienda.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="modal-footer d-flex justify-content-between">
                      <button
                        type="button"
                        className="btn btn-outline-light"
                        onClick={closeFormModal}
                        disabled={submitting}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={submitting}
                      >
                        {submitting
                          ? "Guardando..."
                          : editingId
                          ? "Guardar cambios"
                          : "Crear producto"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
            <div className="modal-backdrop fade show admin-modal-backdrop" />
          </>
        )}

        {showScanner && (
          <BarcodeScannerOverlay
            open={showScanner}
            onClose={handleScannerClose}
            onDetected={handleScannerDetected}
            title={
              scannerTarget === "factoryBarcode"
                ? "Escanear código de fábrica"
                : "Escanear código UPC"
            }
            helperText="Permite el acceso a la cámara y acerca el código de barras para capturarlo"
          />
        )}
      </div>
    </main>
  );
}
