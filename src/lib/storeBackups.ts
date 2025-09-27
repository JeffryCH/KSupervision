import { ObjectId, WithId } from "mongodb";
import { getStoreBackupsCollection } from "./mongodb";
import type { StoreDTO } from "./stores";

export interface StoreBackupMetadata {
  reason?: string;
  createdBy?: string;
  sourceFilename?: string;
  columns?: string[];
}

export interface StoreBackupDocument {
  _id: ObjectId;
  createdAt: Date;
  reason?: string;
  createdBy?: string;
  sourceFilename?: string;
  columns?: string[];
  totalStores: number;
  stores: StoreDTO[];
}

export async function createStoreBackup(
  stores: StoreDTO[],
  metadata: StoreBackupMetadata = {}
) {
  const collection = await getStoreBackupsCollection();

  const doc = {
    createdAt: new Date(),
    reason: metadata.reason?.trim() || undefined,
    createdBy: metadata.createdBy?.trim() || undefined,
    sourceFilename: metadata.sourceFilename?.trim() || undefined,
    columns:
      metadata.columns && metadata.columns.length > 0
        ? metadata.columns
        : undefined,
    totalStores: stores.length,
    stores,
  } satisfies Omit<StoreBackupDocument, "_id">;

  const result = await collection.insertOne(doc);

  return {
    backupId: result.insertedId.toHexString(),
    totalStores: stores.length,
  };
}

export async function listStoreBackups(limit = 10) {
  const collection = await getStoreBackupsCollection();
  const cursor = collection
    .find()
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit);

  const items = (await cursor.toArray()) as WithId<StoreBackupDocument>[];
  return items.map((item) => ({
    id: item._id.toHexString(),
    createdAt:
      item.createdAt instanceof Date
        ? item.createdAt.toISOString()
        : new Date(item.createdAt).toISOString(),
    reason: item.reason ?? null,
    createdBy: item.createdBy ?? null,
    sourceFilename: item.sourceFilename ?? null,
    columns: item.columns ?? [],
    totalStores: item.totalStores,
  }));
}
