import { Collection, ObjectId, UpdateFilter } from "mongodb";
import { getUsersCollection, getWorkgroupsCollection } from "./mongodb";
import type { UserRole } from "./users";

interface WorkgroupDocument {
  _id: ObjectId;
  supervisorId: ObjectId;
  memberIds: ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WorkgroupDTO {
  supervisorId: string;
  memberIds: string[];
}

async function getTypedCollection() {
  const collection = await getWorkgroupsCollection();
  return collection as unknown as Collection<WorkgroupDocument>;
}

const SUPERVISOR_ROLES: UserRole[] = ["admin", "supervisor"];
const MEMBER_ROLES: UserRole[] = ["usuario"];

function toHexStrings(ids: ObjectId[]) {
  return ids.map((id) => id.toHexString());
}

async function ensureSupervisor(supervisorId: string) {
  if (!ObjectId.isValid(supervisorId)) {
    throw new Error("El supervisor seleccionado no es válido");
  }

  const usersCollection = await getUsersCollection();
  const _id = new ObjectId(supervisorId);
  const supervisor = await usersCollection.findOne({
    _id,
    role: { $in: SUPERVISOR_ROLES },
    active: { $ne: false },
  });

  if (!supervisor) {
    throw new Error("El supervisor seleccionado no existe o no está activo");
  }

  return _id;
}

async function ensureMember(memberId: string) {
  if (!ObjectId.isValid(memberId)) {
    throw new Error("El colaborador seleccionado no es válido");
  }

  const usersCollection = await getUsersCollection();
  const _id = new ObjectId(memberId);
  const member = await usersCollection.findOne({
    _id,
    role: { $in: MEMBER_ROLES },
    active: { $ne: false },
  });

  if (!member) {
    throw new Error(
      "El colaborador seleccionado no existe o no está habilitado para asignación"
    );
  }

  return _id;
}

async function resolveSupervisorIds(ids: string[] | undefined) {
  if (!ids || ids.length === 0) {
    return [] as ObjectId[];
  }

  const unique = Array.from(
    new Set(
      ids
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );

  const resolved: ObjectId[] = [];

  for (const value of unique) {
    resolved.push(await ensureSupervisor(value));
  }

  return resolved;
}

async function resolveMemberIds(ids: string[] | undefined) {
  if (!ids || ids.length === 0) {
    return [] as ObjectId[];
  }

  const unique = Array.from(
    new Set(
      ids
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );

  const resolved: ObjectId[] = [];

  for (const value of unique) {
    resolved.push(await ensureMember(value));
  }

  return resolved;
}

function mapDocument(doc: WorkgroupDocument): WorkgroupDTO {
  return {
    supervisorId: doc.supervisorId.toHexString(),
    memberIds: toHexStrings(doc.memberIds ?? []),
  };
}

export async function listWorkgroups(): Promise<WorkgroupDTO[]> {
  const collection = await getTypedCollection();
  const docs = await collection.find({}).toArray();
  return docs.map((doc) => mapDocument(doc));
}

export async function listSupervisorIdsForMember(
  memberId: string
): Promise<string[]> {
  if (!ObjectId.isValid(memberId)) {
    return [];
  }

  const collection = await getTypedCollection();
  const memberObjectId = new ObjectId(memberId);
  const docs = await collection
    .find({ memberIds: memberObjectId })
    .project({ supervisorId: 1 })
    .toArray();

  return docs.map((doc) => doc.supervisorId.toHexString());
}

export async function getWorkgroupBySupervisor(
  supervisorId: string
): Promise<WorkgroupDTO | null> {
  if (!ObjectId.isValid(supervisorId)) {
    return null;
  }

  const collection = await getTypedCollection();
  const doc = await collection.findOne({
    supervisorId: new ObjectId(supervisorId),
  });

  return doc ? mapDocument(doc) : null;
}

export async function setWorkgroupMembers(
  supervisorId: string,
  memberIds: string[]
): Promise<WorkgroupDTO> {
  const collection = await getTypedCollection();
  const supervisorObjectId = await ensureSupervisor(supervisorId);
  const memberObjectIds = await resolveMemberIds(memberIds);

  const now = new Date();
  await collection.updateOne(
    { supervisorId: supervisorObjectId },
    {
      $set: {
        memberIds: memberObjectIds,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
        supervisorId: supervisorObjectId,
      },
    },
    { upsert: true }
  );

  const persisted = await collection.findOne({
    supervisorId: supervisorObjectId,
  });

  if (!persisted) {
    throw new Error("No se pudo guardar el grupo de trabajo");
  }

  return mapDocument(persisted);
}

export async function setMemberSupervisors(
  memberId: string,
  supervisorIds: string[]
): Promise<void> {
  const collection = await getTypedCollection();
  const memberObjectId = await ensureMember(memberId);
  const supervisorObjectIds = await resolveSupervisorIds(supervisorIds);
  const now = new Date();

  const existing = await collection
    .find({ memberIds: memberObjectId })
    .project({ supervisorId: 1 })
    .toArray();

  const allowedSupervisorHex = new Set(
    supervisorObjectIds.map((id) => id.toHexString())
  );

  // Remove from supervisors that are no longer linked
  await Promise.all(
    existing.map(async (doc) => {
      const supervisorHex = doc.supervisorId.toHexString();
      if (!allowedSupervisorHex.has(supervisorHex)) {
        const pullUpdate: UpdateFilter<WorkgroupDocument> = {
          $pull: { memberIds: memberObjectId },
          $set: { updatedAt: now },
        };
        await collection.updateOne(
          { supervisorId: doc.supervisorId },
          pullUpdate
        );
      }
    })
  );

  // Ensure assignment for each selected supervisor
  await Promise.all(
    supervisorObjectIds.map(async (supervisorObjectId) => {
      const addUpdate: UpdateFilter<WorkgroupDocument> = {
        $addToSet: { memberIds: { $each: [memberObjectId] } },
        $set: { updatedAt: now },
      };
      const result = await collection.updateOne(
        { supervisorId: supervisorObjectId },
        addUpdate
      );

      if (result.matchedCount === 0) {
        await collection.insertOne({
          _id: new ObjectId(),
          supervisorId: supervisorObjectId,
          memberIds: [memberObjectId],
          createdAt: now,
          updatedAt: now,
        });
      }
    })
  );
}
