"use client";

import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { useEffect, useMemo } from "react";
import polyline from "@mapbox/polyline";
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

export interface RouteMapStore {
  storeId: string;
  name: string;
  storeNumber?: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

export interface RouteMapProps {
  stores: RouteMapStore[];
  polyline?: string | null;
}

const polylineOptions = {
  color: "#6366f1",
  weight: 5,
  opacity: 0.8,
};

function useRoutePositions(
  stores: RouteMapStore[],
  polylineString: string | null
) {
  return useMemo(() => {
    const storePositions = stores
      .map(
        (store) =>
          [store.location.latitude, store.location.longitude] as [
            number,
            number
          ]
      )
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

    if (polylineString) {
      try {
        const decoded = polyline.decode(polylineString) as [number, number][];
        if (decoded.length > 0) {
          return {
            storePositions,
            pathPositions: decoded,
          };
        }
      } catch (error) {
        console.warn("No se pudo decodificar la polyline de la ruta", error);
      }
    }

    return {
      storePositions,
      pathPositions: storePositions,
    };
  }, [stores, polylineString]);
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || positions.length === 0) {
      return;
    }

    if (positions.length === 1) {
      map.setView(positions[0], 13);
      return;
    }

    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [32, 32] });
  }, [map, positions]);

  return null;
}

export function RouteMap({
  stores,
  polyline: overviewPolyline,
}: RouteMapProps) {
  const { storePositions, pathPositions } = useRoutePositions(
    stores,
    overviewPolyline ?? null
  );

  const hasPositions = storePositions.length > 0;
  const center = hasPositions
    ? storePositions[0]
    : ([9.7489, -83.7534] as [number, number]);

  return (
    <div className="route-map-container rounded-4 overflow-hidden">
      {hasPositions ? (
        <MapContainer
          center={center}
          zoom={7}
          scrollWheelZoom={false}
          className="h-100 w-100"
          style={{ height: "100%", minHeight: "320px", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds positions={pathPositions} />
          {pathPositions.length > 1 ? (
            <Polyline positions={pathPositions} pathOptions={polylineOptions} />
          ) : null}
          {stores.map((store, index) => {
            const { latitude, longitude } = store.location;
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
              return null;
            }

            return (
              <Marker
                key={store.storeId}
                position={[latitude, longitude]}
                title={`${index + 1}. ${store.name}`}
              >
                <Popup>
                  <div className="fw-semibold">{store.name}</div>
                  {store.storeNumber ? (
                    <div className="small text-muted">
                      Código: {store.storeNumber}
                    </div>
                  ) : null}
                  {store.location.address ? (
                    <div className="small mt-1">{store.location.address}</div>
                  ) : null}
                  <div className="small text-muted mt-1">
                    Orden: {index + 1}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      ) : (
        <div className="route-map-placeholder text-center d-flex align-items-center justify-content-center h-100">
          <div>
            <p className="mb-2">
              Selecciona tiendas con coordenadas para ver el mapa.
            </p>
            <small className="text-muted">
              Se mostrarán los puntos del recorrido cuando la ruta tenga
              ubicaciones válidas.
            </small>
          </div>
        </div>
      )}
    </div>
  );
}

export default RouteMap;
