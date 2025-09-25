"use client";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

export interface StoreLocationMapProps {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  name?: string;
  address?: string;
}

export function StoreLocationMap({
  latitude,
  longitude,
  name,
  address,
}: StoreLocationMapProps) {
  const hasPosition =
    typeof latitude === "number" &&
    !Number.isNaN(latitude) &&
    typeof longitude === "number" &&
    !Number.isNaN(longitude);

  const position = useMemo(() => {
    if (!hasPosition) {
      return null;
    }
    return [latitude as number, longitude as number] as [number, number];
  }, [hasPosition, latitude, longitude]);

  return (
    <div className="store-map-container rounded-4 overflow-hidden">
      {position ? (
        <MapContainer
          center={position}
          zoom={16}
          scrollWheelZoom={false}
          className="h-100 w-100"
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={position}>
            <Popup>
              <strong>{name ?? "Ubicación seleccionada"}</strong>
              {address ? <div className="mt-1 small">{address}</div> : null}
              <div className="mt-1 text-muted small">
                Lat: {latitude?.toFixed(6)} | Lng: {longitude?.toFixed(6)}
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      ) : (
        <div className="store-map-placeholder text-center d-flex align-items-center justify-content-center h-100">
          <div>
            <p className="mb-2">
              Agrega coordenadas GPS para visualizar la ubicación.
            </p>
            <small className="text-muted">
              Se mostrará un mapa interactivo cuando ingreses latitud y
              longitud.
            </small>
          </div>
        </div>
      )}
    </div>
  );
}

export default StoreLocationMap;
