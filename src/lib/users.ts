import { ObjectId, WithId } from "mongodb";
import bcrypt from "bcryptjs";
import { getUsersCollection } from "./mongodb";

export type UserRole = "admin" | "supervisor" | "usuario";

type UserMongoDocument = WithId<{
  cedula: string;
  nombre: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}>;

export interface UserDTO {
  id: string;
  cedula: string;
  nombre: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  cedula: string;
  nombre: string;
  email: string;
  password: string;
  role: UserRole;
  active?: boolean;
}

export interface UpdateUserInput {
  cedula?: string;
  nombre?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  active?: boolean;
}

const SALT_ROUNDS = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const ALLOWED_ROLES: UserRole[] = ["admin", "supervisor", "usuario"];

function normalizeCedula(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function sanitizeString(value: string) {
  return value.trim();
}

function mapUserDocument(doc: UserMongoDocument): UserDTO {
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
    cedula: doc.cedula,
    nombre: doc.nombre,
    email: doc.email,
    role: doc.role as UserRole,
    active: Boolean(doc.active ?? true),
    createdAt: createdAtIso,
    updatedAt: updatedAtIso,
  };
}

export async function listUsers(): Promise<UserDTO[]> {
  const collection = await getUsersCollection();
  const users: UserMongoDocument[] = await collection
    .find<UserMongoDocument>({})
    .sort({ createdAt: -1 })
    .toArray();
  return users.map((doc) => mapUserDocument(doc));
}

export async function getUserByCedula(cedula: string) {
  const collection = await getUsersCollection();
  return collection.findOne<UserMongoDocument>({
    cedula: normalizeCedula(cedula),
  });
}

export async function getUserById(id: string): Promise<UserDTO | null> {
  const collection = await getUsersCollection();
  const doc = await collection.findOne<UserMongoDocument>({
    _id: new ObjectId(id),
  });
  return doc ? mapUserDocument(doc) : null;
}

export async function createUser(input: CreateUserInput): Promise<UserDTO> {
  const collection = await getUsersCollection();
  const cedula = normalizeCedula(input.cedula);
  const email = normalizeEmail(input.email);
  const nombre = sanitizeString(input.nombre);

  if (cedula.length < 6) {
    throw new Error("La cédula debe tener al menos 6 dígitos");
  }

  if (!nombre) {
    throw new Error("El nombre es obligatorio");
  }

  if (!EMAIL_REGEX.test(email)) {
    throw new Error("El correo electrónico no es válido");
  }

  if (input.password.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres");
  }

  if (!ALLOWED_ROLES.includes(input.role)) {
    throw new Error("Rol no válido");
  }

  const existing = await collection.findOne<UserMongoDocument>({
    $or: [{ cedula }, { email }],
  });

  if (existing) {
    throw new Error("Ya existe un usuario con la misma cédula o correo");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const now = new Date();

  const doc = {
    cedula,
    nombre,
    email,
    passwordHash,
    role: input.role,
    active: input.active ?? true,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc);
  const inserted = await collection.findOne<UserMongoDocument>({
    _id: result.insertedId,
  });

  if (!inserted) {
    throw new Error("No se pudo crear el usuario");
  }

  return mapUserDocument(inserted);
}

export async function updateUser(
  id: string,
  input: UpdateUserInput
): Promise<UserDTO> {
  const collection = await getUsersCollection();
  const _id = new ObjectId(id);

  const updates: Record<string, unknown> = {};

  if (input.cedula) {
    const cedula = normalizeCedula(input.cedula);
    if (cedula.length < 6) {
      throw new Error("La cédula debe tener al menos 6 dígitos");
    }
    const duplicate = await collection.findOne<UserMongoDocument>({
      cedula,
      _id: { $ne: _id },
    });
    if (duplicate) {
      throw new Error("Otra cuenta ya usa esa cédula");
    }
    updates.cedula = cedula;
  }

  if (input.email) {
    const email = normalizeEmail(input.email);
    if (!EMAIL_REGEX.test(email)) {
      throw new Error("El correo electrónico no es válido");
    }
    const duplicate = await collection.findOne<UserMongoDocument>({
      email,
      _id: { $ne: _id },
    });
    if (duplicate) {
      throw new Error("Otra cuenta ya usa ese correo");
    }
    updates.email = email;
  }

  if (input.nombre) {
    const nombre = sanitizeString(input.nombre);
    if (!nombre) {
      throw new Error("El nombre no puede estar vacío");
    }
    updates.nombre = nombre;
  }

  if (input.role) {
    if (!ALLOWED_ROLES.includes(input.role)) {
      throw new Error("Rol no válido");
    }
    updates.role = input.role;
  }

  if (typeof input.active === "boolean") {
    updates.active = input.active;
  }

  if (input.password) {
    if (input.password.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres");
    }
    updates.passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  }

  if (Object.keys(updates).length === 0) {
    const existing = await collection.findOne<UserMongoDocument>({ _id });
    if (!existing) {
      throw new Error("Usuario no encontrado");
    }
    return mapUserDocument(existing);
  }

  updates.updatedAt = new Date();

  const result = await collection.updateOne({ _id }, { $set: updates });

  if (!result.matchedCount) {
    throw new Error("Usuario no encontrado");
  }

  const updated = await collection.findOne<UserMongoDocument>({ _id });

  if (!updated) {
    throw new Error("Usuario no encontrado tras la actualización");
  }

  return mapUserDocument(updated);
}

export async function deleteUser(id: string) {
  const collection = await getUsersCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}

export async function verifyCredentials(cedula: string, password: string) {
  const collection = await getUsersCollection();
  const normalizedCedula = normalizeCedula(cedula);
  const user = await collection.findOne<UserMongoDocument>({
    cedula: normalizedCedula,
    active: { $ne: false },
  });

  if (!user || !user.passwordHash) {
    return null;
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    return null;
  }

  return mapUserDocument(user);
}
