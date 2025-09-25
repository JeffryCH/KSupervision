"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";

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
  facingMode = "user",
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

        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: facingMode },
            },
          },
          videoRef.current,
          (result, err, controls) => {
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

            if (err && err.name !== "NotFoundException") {
              console.error("Error de lectura del escáner:", err);
            }
          }
        );

        if (!isMounted) {
          controls?.stop();
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
