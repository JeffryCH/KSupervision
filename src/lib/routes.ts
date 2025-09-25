import { ObjectId, WithId } from "mongodb";
import {
  getRoutesCollection,
  getStoresCollection,
  getUsersCollection,
} from "./mongodb";
import type { UserRole } from "./users";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!GOOGLE_API_KEY) {
  throw new Error(
    "GOOGLE_PLACES_API_KEY no está configurado. No se pueden calcular rutas"
  );
}

interface RouteStoreSnapshot {
  storeId: ObjectId;
  name: string;
  storeNumber: string;
  format?: string;
  province?: string;
  canton?: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

interface RouteLegDocument {
  fromStoreId: ObjectId;
  toStoreId: ObjectId;
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
}

type RouteMongoDocument = WithId<{
  name: string;
  description?: string;
  storeOrder: ObjectId[];
  supervisors: ObjectId[];
  assignees: ObjectId[];
  stores: RouteStoreSnapshot[];
  overviewPolyline?: string | null;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  legs: RouteLegDocument[];
  createdAt?: Date;
  updatedAt?: Date;
}>;

export interface RouteDTO {
  id: string;
  name: string;
  description: string;
  storeIds: string[];
  stores: Array<{
    storeId: string;
    name: string;
    storeNumber: string;
    format?: string;
    province?: string;
    canton?: string;
    location: {
      latitude: number;
      longitude: number;
      address?: string;
    };
  }>;
  supervisors: string[];
  assignees: string[];
  overviewPolyline: string | null;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  legs: Array<{
    fromStoreId: string;
    toStoreId: string;
    distanceMeters: number;
    durationSeconds: number;
    distanceText: string;
    durationText: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface RouteListFilters {
  search?: string;
}

export interface CreateRouteInput {
  name: string;
  description?: string;
  storeIds: string[];
  supervisors?: string[];
  assignees?: string[];
}

export interface UpdateRouteInput {
  name?: string;
  description?: string;
  storeIds?: string[];
  supervisors?: string[];
  assignees?: string[];
}

function sanitize(value: string | undefined | null) {
  return (value ?? "").trim();
}

async function resolveUserIds(
  ids: string[] | undefined,
  allowedRoles: UserRole[]
) {
  if (!ids || ids.length === 0) {
    return [];
  }

  const sanitizedIds = Array.from(
    new Set(
      ids
        .map((id) => sanitize(id))
        .filter((id) => id.length > 0 && ObjectId.isValid(id))
    )
  );

  if (sanitizedIds.length === 0) {
    return [];
  }

  const objectIds = sanitizedIds.map((id) => new ObjectId(id));

  const usersCollection = await getUsersCollection();
  const found = await usersCollection
    .find({
      _id: { $in: objectIds },
      role: { $in: allowedRoles },
    })
    .project({ _id: 1 })
    .toArray();

  const foundIds = new Set(found.map((doc) => doc._id.toHexString()));
  return objectIds.filter((id) => foundIds.has(id.toHexString()));
}

async function loadStoresForRoute(storeIds: string[]) {
  if (storeIds.length === 0) {
    throw new Error("Debes seleccionar al menos una tienda");
  }

  const uniqueIds = Array.from(
    new Set(storeIds.map((id) => sanitize(id)).filter(Boolean))
  );

  const objectIds = uniqueIds.map((id) => {
    if (!ObjectId.isValid(id)) {
      throw new Error("Uno de los identificadores de tienda no es válido");
    }
    return new ObjectId(id);
  });

  const collection = await getStoresCollection();
  const docs = await collection.find({ _id: { $in: objectIds } }).toArray();

  const storeMap = new Map(docs.map((doc) => [doc._id.toHexString(), doc]));

  return uniqueIds.map((id) => {
    const storeDoc = storeMap.get(id);
    if (!storeDoc) {
      throw new Error("Alguna de las tiendas seleccionadas no existe");
    }

    const latitude = Number(storeDoc.location?.latitude);
    const longitude = Number(storeDoc.location?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error(
        `La tienda ${storeDoc.name ?? ""} no tiene coordenadas válidas`
      );
    }

    return {
      storeId: new ObjectId(id),
      name: storeDoc.name ?? "Tienda",
      storeNumber: storeDoc.storeNumber ?? "",
      format: storeDoc.format,
      province: storeDoc.province,
      canton: storeDoc.canton,
      location: {
        latitude,
        longitude,
        address: storeDoc.location?.address,
      },
    } satisfies RouteStoreSnapshot;
  });
}

type GoogleDirectionsApiLeg = {
  distance?: { value?: number; text?: string };
  duration?: { value?: number; text?: string };
};

type GoogleDirectionsApiRoute = {
  legs?: GoogleDirectionsApiLeg[];
  overview_polyline?: { points?: string };
};

async function computeDrivingDirections(stores: RouteStoreSnapshot[]) {
  if (stores.length < 2) {
    return {
      overviewPolyline: null as string | null,
      legs: [] as RouteLegDocument[],
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
    };
  }

  const origin = `${stores[0].location.latitude},${stores[0].location.longitude}`;
  const destination = `${stores[stores.length - 1].location.latitude},${
    stores[stores.length - 1].location.longitude
  }`;
  const waypointStores = stores.slice(1, -1);
  const waypoints = waypointStores
    .map((store) => `${store.location.latitude},${store.location.longitude}`)
    .join("|");

  const apiUrl = new URL(
    "https://maps.googleapis.com/maps/api/directions/json"
  );
  apiUrl.searchParams.set("origin", origin);
  apiUrl.searchParams.set("destination", destination);
  apiUrl.searchParams.set("mode", "driving");
  apiUrl.searchParams.set("units", "metric");
  apiUrl.searchParams.set("key", GOOGLE_API_KEY as string);
  if (waypoints.length > 0) {
    apiUrl.searchParams.set("waypoints", `optimize:false|${waypoints}`);
  }

  const response = await fetch(apiUrl.toString());
  const data = await response.json();

  if (data.status !== "OK") {
    const message =
      data.error_message ||
      data.status ||
      "No se pudo calcular la ruta. Verifica las ubicaciones seleccionadas.";
    throw new Error(message);
  }

  const route = data.routes?.[0];
  if (!route) {
    throw new Error("Google Directions no devolvió una ruta válida");
  }

  const routeData = route as GoogleDirectionsApiRoute;
  const rawLegs = Array.isArray(routeData.legs) ? routeData.legs : [];

  const legs: RouteLegDocument[] = [];
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;

  rawLegs.forEach((leg, index) => {
    const distanceMeters = Number(leg.distance?.value ?? 0);
    const durationSeconds = Number(leg.duration?.value ?? 0);
    totalDistanceMeters += distanceMeters;
    totalDurationSeconds += durationSeconds;

    legs.push({
      fromStoreId: stores[index].storeId,
      toStoreId: stores[index + 1].storeId,
      distanceMeters,
      durationSeconds,
      distanceText: leg.distance?.text ?? "",
      durationText: leg.duration?.text ?? "",
    });
  });

  return {
    overviewPolyline: routeData.overview_polyline?.points ?? null,
    legs,
    totalDistanceKm: Number((totalDistanceMeters / 1000).toFixed(2)),
    totalDurationMinutes: Number((totalDurationSeconds / 60).toFixed(1)),
  };
}

function mapRouteDocument(doc: RouteMongoDocument): RouteDTO {
  const createdAtIso =
    doc.createdAt instanceof Date
      ? doc.createdAt.toISOString()
      : doc.createdAt ?? new Date().toISOString();
  const updatedAtIso =
    doc.updatedAt instanceof Date
      ? doc.updatedAt.toISOString()
      : doc.updatedAt ?? createdAtIso;

  return {
    id: doc._id.toHexString(),
    name: doc.name,
    description: doc.description ?? "",
    storeIds: doc.storeOrder.map((id) => id.toHexString()),
    stores: doc.stores.map((store) => ({
      storeId: store.storeId.toHexString(),
      name: store.name,
      storeNumber: store.storeNumber,
      format: store.format,
      province: store.province,
      canton: store.canton,
      location: {
        latitude: store.location.latitude,
        longitude: store.location.longitude,
        address: store.location.address,
      },
    })),
    supervisors: doc.supervisors.map((id) => id.toHexString()),
    assignees: doc.assignees.map((id) => id.toHexString()),
    overviewPolyline: doc.overviewPolyline ?? null,
    totalDistanceKm: doc.totalDistanceKm,
    totalDurationMinutes: doc.totalDurationMinutes,
    legs: doc.legs.map((leg) => ({
      fromStoreId: leg.fromStoreId.toHexString(),
      toStoreId: leg.toStoreId.toHexString(),
      distanceMeters: leg.distanceMeters,
      durationSeconds: leg.durationSeconds,
      distanceText: leg.distanceText,
      durationText: leg.durationText,
    })),
    createdAt: createdAtIso,
    updatedAt: updatedAtIso,
  };
}

export async function listRoutes(filters: RouteListFilters = {}) {
  const collection = await getRoutesCollection();
  const query: Record<string, unknown> = {};

  if (filters.search) {
    const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.name = { $regex: escaped, $options: "i" };
  }

  const routes = await collection.find(query).sort({ createdAt: -1 }).toArray();
  return routes.map((doc) => mapRouteDocument(doc as RouteMongoDocument));
}

export async function getRouteById(id: string) {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const collection = await getRoutesCollection();
  const doc = await collection.findOne({ _id: new ObjectId(id) });
  return doc ? mapRouteDocument(doc as RouteMongoDocument) : null;
}

export async function createRoute(input: CreateRouteInput) {
  const collection = await getRoutesCollection();

  const name = sanitize(input.name);
  const description = sanitize(input.description);
  const storeIds = input.storeIds ?? [];

  if (!name) {
    throw new Error("El nombre de la ruta es obligatorio");
  }

  if (!storeIds.length) {
    throw new Error("Debes seleccionar al menos una tienda");
  }

  const storeSnapshots = await loadStoresForRoute(storeIds);

  const [supervisors, assignees] = await Promise.all([
    resolveUserIds(input.supervisors, ["admin", "supervisor"]),
    resolveUserIds(input.assignees, ["usuario", "supervisor", "admin"]),
  ]);

  const directions = await computeDrivingDirections(storeSnapshots);

  const now = new Date();

  const doc = {
    name,
    description: description || undefined,
    storeOrder: storeSnapshots.map((store) => store.storeId),
    supervisors,
    assignees,
    stores: storeSnapshots,
    overviewPolyline: directions.overviewPolyline,
    totalDistanceKm: directions.totalDistanceKm,
    totalDurationMinutes: directions.totalDurationMinutes,
    legs: directions.legs,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc);
  const inserted = await collection.findOne({ _id: result.insertedId });

  if (!inserted) {
    throw new Error("No se pudo crear la ruta");
  }

  return mapRouteDocument(inserted as RouteMongoDocument);
}

export async function updateRoute(id: string, input: UpdateRouteInput) {
  if (!ObjectId.isValid(id)) {
    throw new Error("Identificador de ruta inválido");
  }

  const collection = await getRoutesCollection();
  const _id = new ObjectId(id);

  const updates: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const name = sanitize(input.name);
    if (!name) {
      throw new Error("El nombre de la ruta es obligatorio");
    }
    updates.name = name;
  }

  if (input.description !== undefined) {
    const description = sanitize(input.description);
    updates.description = description || undefined;
  }

  let storeSnapshots: RouteStoreSnapshot[] | undefined;

  if (input.storeIds !== undefined) {
    if (!input.storeIds.length) {
      throw new Error("Debes seleccionar al menos una tienda");
    }
    storeSnapshots = await loadStoresForRoute(input.storeIds);
    updates.storeOrder = storeSnapshots.map((store) => store.storeId);
    updates.stores = storeSnapshots;
  }

  if (input.supervisors !== undefined) {
    updates.supervisors = await resolveUserIds(input.supervisors, [
      "admin",
      "supervisor",
    ]);
  }

  if (input.assignees !== undefined) {
    updates.assignees = await resolveUserIds(input.assignees, [
      "usuario",
      "supervisor",
      "admin",
    ]);
  }

  if (storeSnapshots) {
    const directions = await computeDrivingDirections(storeSnapshots);
    updates.overviewPolyline = directions.overviewPolyline;
    updates.totalDistanceKm = directions.totalDistanceKm;
    updates.totalDurationMinutes = directions.totalDurationMinutes;
    updates.legs = directions.legs;
  }

  if (Object.keys(updates).length === 0) {
    const current = await collection.findOne({ _id });
    if (!current) {
      throw new Error("Ruta no encontrada");
    }
    return mapRouteDocument(current as RouteMongoDocument);
  }

  updates.updatedAt = new Date();

  const result = await collection.findOneAndUpdate(
    { _id },
    { $set: updates },
    { returnDocument: "after" }
  );

  if (!result || !result.value) {
    throw new Error("Ruta no encontrada");
  }

  return mapRouteDocument(result.value as RouteMongoDocument);
}

export async function deleteRoute(id: string) {
  if (!ObjectId.isValid(id)) {
    return false;
  }

  const collection = await getRoutesCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}
