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
  workPlan?: RouteWorkPlanDocument | null;
  visitStats?: RouteVisitStatsDocument | null;
  createdAt?: Date;
  updatedAt?: Date;
}>;

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type DayOfWeek = (typeof DAY_ORDER)[number];

interface RouteWorkPlanVisitDocument {
  storeId: ObjectId;
  startTime?: string;
  notes?: string;
}

interface RouteWorkPlanDayDocument {
  dayId: DayOfWeek;
  visits: RouteWorkPlanVisitDocument[];
}

interface RouteWorkPlanDocument {
  frequency: "weekly";
  startDate?: Date | null;
  generalNotes?: string;
  days: RouteWorkPlanDayDocument[];
}

interface RouteVisitStatsDocument {
  totalWeeklyVisits: number;
  averageVisitsPerStore: number;
  stores: Array<{
    storeId: ObjectId;
    visitsPerWeek: number;
  }>;
}

type RouteWorkPlanInput = {
  startDate?: string | null;
  generalNotes?: string | null;
  frequency?: string | null;
  days?: Array<{
    dayId?: string;
    visits?: Array<{
      storeId?: string;
      startTime?: string | null;
      notes?: string | null;
    }>;
  }>;
};

export type RouteWorkPlanDTO = {
  frequency: "weekly";
  startDate: string | null;
  generalNotes: string;
  days: Array<{
    dayId: DayOfWeek;
    visits: Array<{
      storeId: string;
      startTime: string | null;
      notes: string;
    }>;
  }>;
};

export interface RouteVisitStatsDTO {
  totalWeeklyVisits: number;
  averageVisitsPerStore: number;
  stores: Array<{
    storeId: string;
    visitsPerWeek: number;
  }>;
}

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
  workPlan: RouteWorkPlanDTO | null;
  visitStats: RouteVisitStatsDTO;
  createdAt: string;
  updatedAt: string;
}

export interface RouteListFilters {
  search?: string;
  supervisorId?: string;
  assigneeId?: string;
}

export interface CreateRouteInput {
  name: string;
  description?: string;
  storeIds: string[];
  supervisors?: string[];
  assignees?: string[];
  workPlan?: RouteWorkPlanInput | null;
}

export interface UpdateRouteInput {
  name?: string;
  description?: string;
  storeIds?: string[];
  supervisors?: string[];
  assignees?: string[];
  workPlan?: RouteWorkPlanInput | null;
}

function sanitize(value: string | undefined | null) {
  return (value ?? "").trim();
}

function buildIdVariants(id: string) {
  const variants: Array<string | ObjectId> = [];
  const trimmed = sanitize(id);

  if (ObjectId.isValid(trimmed)) {
    variants.push(new ObjectId(trimmed));
  }

  if (trimmed.length > 0 && !variants.some((variant) => variant === trimmed)) {
    variants.push(trimmed);
  }

  return variants;
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

function isValidDayId(value: string): value is DayOfWeek {
  return (DAY_ORDER as readonly string[]).includes(value);
}

function sanitizeNullableString(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeTime(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return undefined;
  }

  const isValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed);
  if (!isValid) {
    throw new Error(
      "Uno de los horarios del plan de trabajo no tiene el formato HH:MM"
    );
  }

  return trimmed;
}

function sanitizeDateInput(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("La fecha de inicio del plan de trabajo no es válida");
  }

  return parsed;
}

function normalizeWorkPlanInput(
  input: RouteWorkPlanInput | null | undefined,
  storeSnapshots: RouteStoreSnapshot[]
): RouteWorkPlanDocument | null {
  if (!input) {
    return null;
  }

  const storeMap = new Map(
    storeSnapshots.map((store) => [store.storeId.toHexString(), store])
  );

  const daysInput = Array.isArray(input.days) ? input.days : [];
  const normalizedDays: RouteWorkPlanDayDocument[] = [];

  daysInput.forEach((day) => {
    const rawDayId =
      typeof day.dayId === "string" ? day.dayId.toLowerCase() : "";

    if (!isValidDayId(rawDayId)) {
      return;
    }

    const visitsInput = Array.isArray(day.visits) ? day.visits : [];
    const visits: RouteWorkPlanVisitDocument[] = [];

    visitsInput.forEach((visit) => {
      const storeIdRaw =
        typeof visit.storeId === "string" ? visit.storeId.trim() : "";
      if (!storeIdRaw) {
        return;
      }

      const snapshot = storeMap.get(storeIdRaw);
      if (!snapshot) {
        throw new Error(
          "El plan de trabajo referencia una tienda que no pertenece a la ruta"
        );
      }

      visits.push({
        storeId: snapshot.storeId,
        startTime: sanitizeTime(visit.startTime),
        notes: sanitizeNullableString(visit.notes),
      });
    });

    if (visits.length > 0) {
      normalizedDays.push({
        dayId: rawDayId,
        visits,
      });
    }
  });

  if (normalizedDays.length === 0) {
    throw new Error("Debes planificar al menos una visita en la semana");
  }

  normalizedDays.sort(
    (a, b) => DAY_ORDER.indexOf(a.dayId) - DAY_ORDER.indexOf(b.dayId)
  );

  const startDate = sanitizeDateInput(input.startDate);

  return {
    frequency: "weekly",
    startDate,
    generalNotes: sanitizeNullableString(input.generalNotes),
    days: normalizedDays,
  } satisfies RouteWorkPlanDocument;
}

function computeVisitStats(
  plan: RouteWorkPlanDocument | null,
  storeSnapshots: RouteStoreSnapshot[]
): RouteVisitStatsDocument {
  const storeCounts = new Map<string, number>();
  storeSnapshots.forEach((store) => {
    storeCounts.set(store.storeId.toHexString(), 0);
  });

  let totalVisits = 0;

  if (plan) {
    plan.days.forEach((day) => {
      day.visits.forEach((visit) => {
        const key = visit.storeId.toHexString();
        const current = storeCounts.get(key) ?? 0;
        storeCounts.set(key, current + 1);
        totalVisits += 1;
      });
    });
  }

  const averageVisits =
    storeSnapshots.length > 0
      ? Number((totalVisits / storeSnapshots.length).toFixed(2))
      : 0;

  return {
    totalWeeklyVisits: totalVisits,
    averageVisitsPerStore: averageVisits,
    stores: storeSnapshots.map((store) => ({
      storeId: store.storeId,
      visitsPerWeek: storeCounts.get(store.storeId.toHexString()) ?? 0,
    })),
  } satisfies RouteVisitStatsDocument;
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

  const workPlanDto: RouteWorkPlanDTO | null = doc.workPlan
    ? {
        frequency: "weekly",
        startDate: doc.workPlan.startDate
          ? doc.workPlan.startDate.toISOString().slice(0, 10)
          : null,
        generalNotes: doc.workPlan.generalNotes ?? "",
        days: doc.workPlan.days.map((day) => ({
          dayId: day.dayId,
          visits: day.visits.map((visit) => ({
            storeId: visit.storeId.toHexString(),
            startTime: visit.startTime ?? null,
            notes: visit.notes ?? "",
          })),
        })),
      }
    : null;

  const visitStatsDoc = doc.visitStats
    ? doc.visitStats
    : computeVisitStats(doc.workPlan ?? null, doc.stores);

  const visitStatsDto: RouteVisitStatsDTO = {
    totalWeeklyVisits: visitStatsDoc.totalWeeklyVisits ?? 0,
    averageVisitsPerStore: visitStatsDoc.averageVisitsPerStore ?? 0,
    stores: visitStatsDoc.stores.map((store) => ({
      storeId: store.storeId.toHexString(),
      visitsPerWeek: store.visitsPerWeek ?? 0,
    })),
  };

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
    workPlan: workPlanDto,
    visitStats: visitStatsDto,
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

  if (filters.supervisorId) {
    const variants = buildIdVariants(filters.supervisorId);
    if (variants.length === 0) {
      return [];
    }
    query.supervisors = variants.length === 1 ? variants[0] : { $in: variants };
  }

  if (filters.assigneeId) {
    const variants = buildIdVariants(filters.assigneeId);
    if (variants.length === 0) {
      return [];
    }
    query.assignees = variants.length === 1 ? variants[0] : { $in: variants };
  }

  const routes = await collection.find(query).sort({ createdAt: -1 }).toArray();
  return routes.map((doc) => mapRouteDocument(doc as RouteMongoDocument));
}

export async function getRouteById(id: string) {
  const collection = await getRoutesCollection();
  const variants = buildIdVariants(id);

  for (const variant of variants) {
    const filter = { _id: variant } as never;
    const doc = await collection.findOne(filter);
    if (doc) {
      return mapRouteDocument(doc as RouteMongoDocument);
    }
  }

  return null;
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

  const workPlan = normalizeWorkPlanInput(input.workPlan, storeSnapshots);
  if (!workPlan) {
    throw new Error("Debes definir un plan de trabajo para la ruta");
  }

  const visitStats = computeVisitStats(workPlan, storeSnapshots);
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
    workPlan,
    visitStats,
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
  const collection = await getRoutesCollection();
  const idVariants = buildIdVariants(id);

  if (idVariants.length === 0) {
    throw new Error("Identificador de ruta inválido");
  }

  let currentDoc: RouteMongoDocument | null = null;
  for (const variant of idVariants) {
    const filter = { _id: variant } as never;
    const doc = await collection.findOne(filter);
    if (doc) {
      currentDoc = doc as RouteMongoDocument;
      break;
    }
  }

  if (!currentDoc) {
    throw new Error("Ruta no encontrada");
  }

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
  let baseStoreSnapshots = currentDoc.stores;

  if (input.storeIds !== undefined) {
    if (!input.storeIds.length) {
      throw new Error("Debes seleccionar al menos una tienda");
    }

    if (input.workPlan === undefined) {
      throw new Error(
        "Debes actualizar el plan de trabajo cuando modificas las tiendas de la ruta"
      );
    }
    storeSnapshots = await loadStoresForRoute(input.storeIds);
    updates.storeOrder = storeSnapshots.map((store) => store.storeId);
    updates.stores = storeSnapshots;
    baseStoreSnapshots = storeSnapshots;
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

  if (input.workPlan === null) {
    throw new Error("El plan de trabajo no puede eliminarse");
  }

  if (input.workPlan !== undefined) {
    const normalizedPlan = normalizeWorkPlanInput(
      input.workPlan,
      baseStoreSnapshots
    );

    if (!normalizedPlan) {
      throw new Error("Debes definir un plan de trabajo para la ruta");
    }

    updates.workPlan = normalizedPlan;
    updates.visitStats = computeVisitStats(normalizedPlan, baseStoreSnapshots);
  }

  if (Object.keys(updates).length === 0) {
    return mapRouteDocument(currentDoc);
  }

  updates.updatedAt = new Date();

  for (const variant of idVariants) {
    const filter = { _id: variant } as never;
    const result = await collection.findOneAndUpdate(
      filter,
      { $set: updates },
      { returnDocument: "after" }
    );

    if (result && result.value) {
      return mapRouteDocument(result.value as RouteMongoDocument);
    }
  }

  throw new Error("Ruta no encontrada");
}

export async function deleteRoute(id: string) {
  const collection = await getRoutesCollection();
  const idVariants = buildIdVariants(id);

  for (const variant of idVariants) {
    const filter = { _id: variant } as never;
    const result = await collection.deleteOne(filter);
    if (result.deletedCount === 1) {
      return true;
    }
  }

  return false;
}
