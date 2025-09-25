import { ObjectId, WithId } from "mongodb";
import { getStoresCollection, getUsersCollection } from "./mongodb";
import type { UserRole } from "./users";

export type StoreFormat = "Walmart" | "Mas x Menos" | "Pali" | "Maxi Pali";

interface StoreLocationDocument {
  latitude: number;
  longitude: number;
  address?: string;
  placeId?: string;
}

type StoreMongoDocument = WithId<{
  name: string;
  storeNumber: string;
  format: StoreFormat;
  province: string;
  canton: string;
  supervisors: ObjectId[];
  location: StoreLocationDocument;
  createdAt?: Date;
  updatedAt?: Date;
}>;

export interface StoreDTO {
  id: string;
  name: string;
  storeNumber: string;
  format: StoreFormat;
  province: string;
  canton: string;
  supervisors: string[];
  location: StoreLocationDocument;
  createdAt: string;
  updatedAt: string;
}

export interface StoreListFilters {
  search?: string;
  format?: StoreFormat;
  province?: string;
}

export interface CreateStoreInput {
  name: string;
  storeNumber: string;
  format: StoreFormat;
  province: string;
  canton: string;
  supervisors?: string[];
  latitude: number;
  longitude: number;
  address?: string;
  placeId?: string;
}

export interface UpdateStoreInput {
  name?: string;
  storeNumber?: string;
  format?: StoreFormat;
  province?: string;
  canton?: string;
  supervisors?: string[];
  latitude?: number;
  longitude?: number;
  address?: string;
  placeId?: string;
}

const ALLOWED_FORMATS: StoreFormat[] = [
  "Walmart",
  "Mas x Menos",
  "Pali",
  "Maxi Pali",
];

function sanitizeString(value: string | undefined | null) {
  return (value ?? "").trim();
}

function normalizeStoreNumber(value: string) {
  return sanitizeString(value).replace(/[^0-9A-Za-z-]/g, "");
}

function validateFormat(format: string): format is StoreFormat {
  return ALLOWED_FORMATS.includes(format as StoreFormat);
}

function validateCoordinates(latitude: number, longitude: number) {
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw new Error("Las coordenadas GPS son inválidas");
  }

  if (latitude < -90 || latitude > 90) {
    throw new Error("La latitud debe estar entre -90 y 90");
  }

  if (longitude < -180 || longitude > 180) {
    throw new Error("La longitud debe estar entre -180 y 180");
  }
}

function mapStoreDocument(doc: StoreMongoDocument): StoreDTO {
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
    storeNumber: doc.storeNumber,
    format: doc.format,
    province: doc.province,
    canton: doc.canton,
    supervisors: doc.supervisors?.map((sup) => sup.toHexString()) ?? [],
    location: {
      latitude: doc.location.latitude,
      longitude: doc.location.longitude,
      address: doc.location.address,
      placeId: doc.location.placeId,
    },
    createdAt: createdAtIso,
    updatedAt: updatedAtIso,
  };
}

function buildSearchQuery(filters: StoreListFilters) {
  const query: Record<string, unknown> = {};

  if (filters.search) {
    const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { storeNumber: { $regex: escaped, $options: "i" } },
      { province: { $regex: escaped, $options: "i" } },
      { canton: { $regex: escaped, $options: "i" } },
    ];
  }

  if (filters.format) {
    query.format = filters.format;
  }

  if (filters.province) {
    const escapedProv = filters.province.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.province = { $regex: escapedProv, $options: "i" };
  }

  return query;
}

async function resolveSupervisorIds(ids: string[] | undefined) {
  if (!ids || ids.length === 0) {
    return [];
  }

  const sanitizedIds = ids
    .map((id) => sanitizeString(id))
    .filter((id) => id.length > 0);

  if (sanitizedIds.length === 0) {
    return [];
  }

  const objectIds = sanitizedIds
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));

  const usersCollection = await getUsersCollection();
  const allowedRoles: UserRole[] = ["admin", "supervisor"];

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

export async function listStores(filters: StoreListFilters = {}) {
  const collection = await getStoresCollection();
  const query = buildSearchQuery(filters);

  const stores = await collection.find(query).sort({ createdAt: -1 }).toArray();

  return stores.map((doc) => mapStoreDocument(doc as StoreMongoDocument));
}

export async function getStoreById(id: string) {
  const collection = await getStoresCollection();
  const doc = await collection.findOne({ _id: new ObjectId(id) });
  return doc ? mapStoreDocument(doc as StoreMongoDocument) : null;
}

export async function createStore(input: CreateStoreInput) {
  const collection = await getStoresCollection();

  const name = sanitizeString(input.name);
  const storeNumber = normalizeStoreNumber(input.storeNumber);
  const province = sanitizeString(input.province);
  const canton = sanitizeString(input.canton);
  const address = sanitizeString(input.address ?? "");
  const placeId = sanitizeString(input.placeId ?? "");
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);

  if (!name) {
    throw new Error("El nombre de la tienda es obligatorio");
  }

  if (!storeNumber) {
    throw new Error("El número de tienda es obligatorio");
  }

  if (!validateFormat(input.format)) {
    throw new Error("El formato de tienda no es válido");
  }

  if (!province) {
    throw new Error("La provincia es obligatoria");
  }

  if (!canton) {
    throw new Error("La zona o cantón es obligatoria");
  }

  validateCoordinates(latitude, longitude);

  const existing = await collection.findOne({ storeNumber });
  if (existing) {
    throw new Error("Ya existe una tienda con ese número");
  }

  const supervisorIds = await resolveSupervisorIds(input.supervisors);

  const now = new Date();

  const doc = {
    name,
    storeNumber,
    format: input.format,
    province,
    canton,
    supervisors: supervisorIds,
    location: {
      latitude,
      longitude,
      address: address || undefined,
      placeId: placeId || undefined,
    },
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc);
  const inserted = await collection.findOne({ _id: result.insertedId });

  if (!inserted) {
    throw new Error("No se pudo crear la tienda");
  }

  return mapStoreDocument(inserted as StoreMongoDocument);
}

export async function updateStore(id: string, input: UpdateStoreInput) {
  const collection = await getStoresCollection();
  const _id = new ObjectId(id);

  const updates: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const name = sanitizeString(input.name);
    if (!name) {
      throw new Error("El nombre de la tienda es obligatorio");
    }
    updates.name = name;
  }

  if (input.storeNumber !== undefined) {
    const storeNumber = normalizeStoreNumber(input.storeNumber);
    if (!storeNumber) {
      throw new Error("El número de tienda es obligatorio");
    }

    const duplicate = await collection.findOne({
      storeNumber,
      _id: { $ne: _id },
    });

    if (duplicate) {
      throw new Error("Otra tienda ya usa ese número");
    }

    updates.storeNumber = storeNumber;
  }

  if (input.format !== undefined) {
    if (!validateFormat(input.format)) {
      throw new Error("El formato de tienda no es válido");
    }
    updates.format = input.format;
  }

  if (input.province !== undefined) {
    const province = sanitizeString(input.province);
    if (!province) {
      throw new Error("La provincia es obligatoria");
    }
    updates.province = province;
  }

  if (input.canton !== undefined) {
    const canton = sanitizeString(input.canton);
    if (!canton) {
      throw new Error("La zona o cantón es obligatoria");
    }
    updates.canton = canton;
  }

  if (input.supervisors !== undefined) {
    const supervisorIds = await resolveSupervisorIds(input.supervisors);
    updates.supervisors = supervisorIds;
  }

  const locationUpdates: Partial<StoreLocationDocument> = {};
  let shouldUpdateLocation = false;

  if (input.latitude !== undefined) {
    const latitude = Number(input.latitude);
    if (!Number.isFinite(latitude)) {
      throw new Error("La latitud es inválida");
    }
    locationUpdates.latitude = latitude;
    shouldUpdateLocation = true;
  }

  if (input.longitude !== undefined) {
    const longitude = Number(input.longitude);
    if (!Number.isFinite(longitude)) {
      throw new Error("La longitud es inválida");
    }
    locationUpdates.longitude = longitude;
    shouldUpdateLocation = true;
  }

  if (input.address !== undefined) {
    const address = sanitizeString(input.address);
    locationUpdates.address = address || undefined;
    shouldUpdateLocation = true;
  }

  if (input.placeId !== undefined) {
    const placeId = sanitizeString(input.placeId);
    locationUpdates.placeId = placeId || undefined;
    shouldUpdateLocation = true;
  }

  if (shouldUpdateLocation) {
    const existing = await collection.findOne({ _id });
    if (!existing) {
      throw new Error("Tienda no encontrada");
    }

    const currentLocation = (existing as StoreMongoDocument).location;
    const finalLatitude =
      locationUpdates.latitude ?? Number(currentLocation.latitude);
    const finalLongitude =
      locationUpdates.longitude ?? Number(currentLocation.longitude);

    validateCoordinates(finalLatitude, finalLongitude);

    updates.location = {
      latitude: finalLatitude,
      longitude: finalLongitude,
      address:
        locationUpdates.address !== undefined
          ? (locationUpdates.address as string | undefined)
          : currentLocation.address,
      placeId:
        locationUpdates.placeId !== undefined
          ? (locationUpdates.placeId as string | undefined)
          : currentLocation.placeId,
    };
  }

  if (Object.keys(updates).length === 0) {
    const existing = await collection.findOne({ _id });
    if (!existing) {
      throw new Error("Tienda no encontrada");
    }
    return mapStoreDocument(existing as StoreMongoDocument);
  }

  updates.updatedAt = new Date();

  const result = await collection.updateOne({ _id }, { $set: updates });

  if (!result.matchedCount) {
    throw new Error("Tienda no encontrada");
  }

  const updated = await collection.findOne({ _id });

  if (!updated) {
    throw new Error("Tienda no encontrada tras la actualización");
  }

  return mapStoreDocument(updated as StoreMongoDocument);
}

export async function deleteStore(id: string) {
  const collection = await getStoresCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}
