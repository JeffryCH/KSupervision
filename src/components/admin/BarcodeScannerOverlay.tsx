"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import type { Result } from "@zxing/library";

export interface BarcodeScannerOverlayProps {
  open: boolean;
  onClose: () => void;
  onDetected: (value: string) => void;
  title?: string;
  facingMode?: "user" | "environment";
  helperText?: string;
}

export default function BarcodeScannerOverlay({
  open,
  onClose,
  onDetected,
  title = "Escanear código de barras",
  facingMode = "environment",
  helperText = "Alinea el código dentro del recuadro para detectarlo automáticamente.",
}: BarcodeScannerOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const hasDetectedRef = useRef(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      hasDetectedRef.current = false;
      setError(null);
      return;
    }

    let isMounted = true;
    const reader = new BrowserMultiFormatReader();
    hasDetectedRef.current = false;
    setInitializing(true);
    setError(null);

    const startScanner = async () => {
      try {
        if (!videoRef.current) {
          throw new Error("No se pudo acceder al elemento de video");
        }

        if (typeof navigator === "undefined") {
          setError("El acceso a la cámara no está disponible en este contexto");
          setInitializing(false);
          return;
        }

        if (
          !navigator.mediaDevices ||
          typeof navigator.mediaDevices.getUserMedia !== "function"
        ) {
          setError(
            "Este navegador no soporta la captura de video o la cámara está deshabilitada"
          );
          setInitializing(false);
          return;
        }

        const handleResult = (
          result: Result | undefined,
          err: unknown,
          controls?: IScannerControls
        ) => {
          if (!isMounted) {
            return;
          }

          if (controls && !controlsRef.current) {
            controlsRef.current = controls;
          }

          if (result && !hasDetectedRef.current) {
            const text = result.getText();
            if (text) {
              hasDetectedRef.current = true;
              controlsRef.current?.stop();
              controlsRef.current = null;
              onDetected(text);
              onClose();
            }
          }

          if (err) {
            const isNotFound =
              err instanceof Error && err.name === "NotFoundException";
            if (!isNotFound) {
              console.error("Error de lectura del escáner:", err);
            }
          }
        };

        const constraintsFor = (mode: "user" | "environment") => ({
          video: {
            facingMode: { ideal: mode },
          },
        });

        let controls: IScannerControls | null = null;

        try {
          controls = await reader.decodeFromConstraints(
            constraintsFor(facingMode),
            videoRef.current,
            handleResult
          );
        } catch (primaryError) {
          if (facingMode === "environment") {
            console.warn(
              "No se pudo acceder a la cámara trasera, intentando con la frontal",
              primaryError
            );
            controls = await reader.decodeFromConstraints(
              constraintsFor("user"),
              videoRef.current,
              handleResult
            );
          } else {
            throw primaryError;
          }
        }

        if (!controls) {
          throw new Error("No se pudo iniciar el escáner");
        }

        if (!isMounted) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setInitializing(false);
      } catch (scanError) {
        console.error("No se pudo iniciar el escáner:", scanError);
        if (!isMounted) {
          return;
        }
        setError(
          scanError instanceof Error
            ? scanError.message
            : "No se pudo acceder a la cámara"
        );
        setInitializing(false);
      }
    };

    void startScanner();

    return () => {
      isMounted = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, facingMode, onClose, onDetected]);

  if (!open) {
    return null;
  }

  return (
    <div className="barcode-overlay-backdrop" role="dialog" aria-modal="true">
      <div className="barcode-overlay-card" aria-live="polite">
        <header className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h2 className="h4 mb-1">{title}</h2>
            <p className="text-muted small mb-0">{helperText}</p>
          </div>
          <button
            type="button"
            className="btn btn-outline-light"
            onClick={onClose}
          >
            Cerrar
          </button>
        </header>

        <div className="scanner-video-wrapper mb-3">
          <video
            ref={videoRef}
            className="scanner-video"
            autoPlay
            muted
            playsInline
          />
          <div className="scanner-reticle" aria-hidden="true" />
        </div>

        {initializing && !error ? (
          <p className="text-center text-muted mb-0">
            Activando cámara, por favor espera…
          </p>
        ) : null}

        {error ? (
          <div className="alert alert-danger mb-0" role="alert">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
