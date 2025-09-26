"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

interface CameraOption {
  deviceId: string;
  label: string;
  facingMode: "environment" | "user" | "unknown";
}

export interface ProductImageCaptureOverlayProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  initialFacingMode?: "environment" | "user";
}

function inferFacingMode(label: string | undefined | null) {
  if (!label) {
    return "unknown" as const;
  }

  const normalized = label.toLowerCase();

  if (/(back|rear|environment|trase|externa)/i.test(normalized)) {
    return "environment" as const;
  }

  if (/(front|user|webcam|interna|frontal)/i.test(normalized)) {
    return "user" as const;
  }

  return "unknown" as const;
}

async function createFileFromCanvas(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((result) => resolve(result), "image/jpeg", 0.92)
  );

  if (!blob) {
    throw new Error("No se pudo capturar la imagen");
  }

  return new File([blob], `producto-${Date.now()}.jpg`, {
    type: blob.type ?? "image/jpeg",
  });
}

export default function ProductImageCaptureOverlay({
  open,
  onClose,
  onCapture,
  initialFacingMode = "environment",
}: ProductImageCaptureOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const selectedDeviceIdRef = useRef<string | null>(null);
  const [devices, setDevices] = useState<CameraOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  const backCameras = useMemo(
    () => devices.filter((device) => device.facingMode === "environment"),
    [devices]
  );

  const availableOptions = useMemo(() => {
    if (backCameras.length > 0) {
      const others = devices.filter(
        (device) => device.facingMode !== "environment"
      );
      return [...backCameras, ...others];
    }
    return devices;
  }, [devices, backCameras]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const updateStream = useCallback(
    async (deviceId?: string) => {
      if (typeof navigator === "undefined") {
        throw new Error("Contexto sin acceso a navegador");
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Este navegador no permite acceder a la cámara o está deshabilitada"
        );
      }

      const previousDeviceId = selectedDeviceIdRef.current;
      const hadStream = Boolean(streamRef.current);

      const applyStream = async (
        stream: MediaStream,
        preferredDeviceId: string | null
      ) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        streamRef.current = stream;
        setHasPermission(true);

        const track = stream.getVideoTracks()[0];
        const settings = track?.getSettings();
        const activeDeviceId = settings?.deviceId ?? preferredDeviceId ?? null;

        const mediaDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = mediaDevices.filter(
          (info) => info.kind === "videoinput"
        );

        setDevices(
          videoDevices.map((info, index) => {
            const facingFromLabel = inferFacingMode(info.label);
            const facingFromSettings =
              info.deviceId === activeDeviceId && settings?.facingMode
                ? (settings.facingMode as "environment" | "user" | undefined)
                : undefined;

            const facing = facingFromSettings ?? facingFromLabel;
            const fallbackLabel = `Cámara ${index + 1}`;

            return {
              deviceId: info.deviceId,
              label: info.label || fallbackLabel,
              facingMode: facing ?? "unknown",
            } as CameraOption;
          })
        );

        if (activeDeviceId) {
          setSelectedDeviceId(activeDeviceId);
        } else if (videoDevices[0]) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        } else {
          setSelectedDeviceId(null);
        }
      };

      if (hadStream) {
        stopStream();
        await new Promise<void>((resolve) => setTimeout(resolve, 80));
      } else {
        stopStream();
      }

      const constraints = deviceId
        ? { video: { deviceId: { exact: deviceId } }, audio: false }
        : {
            video: {
              facingMode: { ideal: initialFacingMode },
            },
            audio: false,
          };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        await applyStream(stream, deviceId ?? null);
      } catch (primaryError) {
        console.error("No se pudo iniciar la cámara solicitada:", primaryError);

        if (hadStream && previousDeviceId) {
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: previousDeviceId } },
              audio: false,
            });

            await applyStream(fallbackStream, previousDeviceId);
          } catch (restoreError) {
            console.error(
              "No se pudo restaurar la cámara anterior:",
              restoreError
            );
          }
        }

        throw primaryError;
      }
    },
    [initialFacingMode, stopStream]
  );

  useEffect(() => {
    selectedDeviceIdRef.current = selectedDeviceId;
  }, [selectedDeviceId]);

  useEffect(() => {
    if (!open) {
      stopStream();
      setDevices([]);
      setSelectedDeviceId(null);
      setError(null);
      setHasPermission(false);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let cancelled = false;

    const initialize = async () => {
      setInitializing(true);
      setError(null);

      try {
        await updateStream();
      } catch (err) {
        if (!cancelled) {
          console.error("No se pudo iniciar la cámara:", err);
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo acceder a la cámara"
          );
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    };

    void initialize();

    const handleDeviceChange = () => {
      void updateStream(selectedDeviceIdRef.current ?? undefined);
    };

    navigator.mediaDevices?.addEventListener(
      "devicechange",
      handleDeviceChange
    );

    return () => {
      cancelled = true;
      document.body.style.overflow = previousOverflow;
      navigator.mediaDevices?.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
      stopStream();
    };
  }, [open, updateStream, stopStream]);

  const handleSelectChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const deviceId = event.target.value;
    setInitializing(true);
    setError(null);
    try {
      await updateStream(deviceId);
    } catch (err) {
      console.error("No se pudo cambiar de cámara:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cambiar a la cámara seleccionada"
      );
    } finally {
      setInitializing(false);
    }
  };

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video) {
      setError("No se encontró el elemento de video");
      return;
    }

    if (!hasPermission) {
      setError("Debes permitir el acceso a la cámara para tomar la foto");
      return;
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setError(
        "La cámara aún se está inicializando, intenta de nuevo en un momento"
      );
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      setError("No se pudo determinar la resolución del video");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      setError("No se pudo crear el contexto de dibujo para la captura");
      return;
    }

    context.drawImage(video, 0, 0, width, height);

    try {
      const file = await createFileFromCanvas(canvas);
      onCapture(file);
    } catch (err) {
      console.error("Error al crear archivo desde la captura:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo generar la imagen capturada"
      );
    }
  };

  const renderCameraOptionLabel = (option: CameraOption) => {
    const suffix =
      option.facingMode === "environment"
        ? " (trasera)"
        : option.facingMode === "user"
        ? " (frontal)"
        : "";
    return `${option.label}${suffix}`;
  };

  if (!open) {
    return null;
  }

  return (
    <div className="barcode-overlay-backdrop" role="dialog" aria-modal="true">
      <div className="barcode-overlay-card image-capture-card">
        <header className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h2 className="h4 mb-0">Capturar imagen del producto</h2>
            <p className="text-muted small mb-0">
              Usa la cámara trasera para obtener una foto nítida y bien
              iluminada.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline-light"
            onClick={onClose}
            disabled={initializing}
          >
            Cerrar
          </button>
        </header>

        <div className="mb-3 d-flex flex-column gap-2">
          <label htmlFor="camera-selector" className="form-label small mb-1">
            Selecciona la cámara
          </label>
          <select
            id="camera-selector"
            className="form-select"
            value={selectedDeviceId ?? ""}
            onChange={handleSelectChange}
            disabled={initializing || availableOptions.length === 0}
          >
            {availableOptions.length === 0 ? (
              <option value="">No hay cámaras disponibles</option>
            ) : null}
            {availableOptions.map((option) => (
              <option key={option.deviceId} value={option.deviceId}>
                {renderCameraOptionLabel(option)}
              </option>
            ))}
          </select>
          {backCameras.length > 1 ? (
            <p className="text-muted small mb-0">
              Se detectaron múltiples cámaras traseras. Selecciona la que
              ofrezca mejor calidad.
            </p>
          ) : null}
        </div>

        <div className="capture-video-wrapper mb-3">
          <video
            ref={videoRef}
            className="capture-video"
            autoPlay
            muted
            playsInline
          />
          {!hasPermission && !error ? (
            <div className="capture-permission-overlay">
              <p className="text-center text-muted mb-0">
                Otorga permiso a la cámara para ver la previsualización aquí.
              </p>
            </div>
          ) : null}
        </div>

        {initializing ? (
          <p className="text-center text-muted mb-3">
            Preparando la cámara{selectedDeviceId ? " seleccionada" : ""}…
          </p>
        ) : null}

        {error ? (
          <div className="alert alert-danger mb-3" role="alert">
            {error}
          </div>
        ) : null}

        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <p className="text-muted small mb-0">
            Asegúrate de tener buena iluminación y enfocar el producto antes de
            capturar.
          </p>
          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline-light"
              onClick={() => void updateStream(selectedDeviceId ?? undefined)}
              disabled={initializing}
            >
              Reintentar cámara
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCapture}
              disabled={initializing}
            >
              Capturar foto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
