import { ObjectId, WithId } from "mongodb";
import { getProductsCollection } from "./mongodb";

export interface ProductDTO {
  id: string;
  name: string;
  factoryBarcode: string;
  upcCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListFilters {
  search?: string;
}

export interface CreateProductInput {
  name: string;
  factoryBarcode: string;
  upcCode: string;
}

export interface UpdateProductInput {
  name?: string;
  factoryBarcode?: string;
  upcCode?: string;
}

type ProductMongoDocument = WithId<{
  name: string;
  factoryBarcode: string;
  upcCode: string;
  createdAt?: Date;
  updatedAt?: Date;
}>;

function sanitizeString(value: string | null | undefined) {
  return (value ?? "").trim();
}

function normalizeBarcode(value: string) {
  return sanitizeString(value)
    .replace(/\s+/g, "")
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase();
}

function mapProductDocument(doc: ProductMongoDocument): ProductDTO {
  const createdAt =
    doc.createdAt instanceof Date
      ? doc.createdAt.toISOString()
      : doc.createdAt ?? new Date().toISOString();
  const updatedAt =
    doc.updatedAt instanceof Date
      ? doc.updatedAt.toISOString()
      : doc.updatedAt ?? createdAt;

  return {
    id: doc._id.toHexString(),
    name: doc.name,
    factoryBarcode: doc.factoryBarcode,
    upcCode: doc.upcCode,
    createdAt,
    updatedAt,
  };
}

function buildSearchQuery(filters: ProductListFilters) {
  const query: Record<string, unknown> = {};

  if (filters.search) {
    const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { factoryBarcode: { $regex: escaped, $options: "i" } },
      { upcCode: { $regex: escaped, $options: "i" } },
    ];
  }

  return query;
}

export async function listProducts(filters: ProductListFilters = {}) {
  const collection = await getProductsCollection();
  const query = buildSearchQuery(filters);
  const items = await collection.find(query).sort({ createdAt: -1 }).toArray();
  return items.map((doc) => mapProductDocument(doc as ProductMongoDocument));
}

export async function getProductById(id: string) {
  const collection = await getProductsCollection();
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const doc = await collection.findOne({ _id: new ObjectId(id) });
  return doc ? mapProductDocument(doc as ProductMongoDocument) : null;
}

export async function createProduct(input: CreateProductInput) {
  const collection = await getProductsCollection();

  const name = sanitizeString(input.name);
  const factoryBarcode = normalizeBarcode(input.factoryBarcode);
  const upcCode = normalizeBarcode(input.upcCode);

  if (!name) {
    throw new Error("El nombre del producto es obligatorio");
  }

  if (!factoryBarcode) {
    throw new Error("El código de barras de fábrica es obligatorio");
  }

  if (!upcCode) {
    throw new Error("El código UPC es obligatorio");
  }

  const duplicateFactory = await collection.findOne({ factoryBarcode });
  if (duplicateFactory) {
    throw new Error(
      "Ya existe un producto con ese código de barras de fábrica"
    );
  }

  const duplicateUpc = await collection.findOne({ upcCode });
  if (duplicateUpc) {
    throw new Error("Ya existe un producto con ese código UPC");
  }

  const now = new Date();
  const doc = {
    name,
    factoryBarcode,
    upcCode,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc);
  const inserted = await collection.findOne({ _id: result.insertedId });

  if (!inserted) {
    throw new Error("No se pudo crear el producto");
  }

  return mapProductDocument(inserted as ProductMongoDocument);
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  if (!ObjectId.isValid(id)) {
    throw new Error("Identificador inválido");
  }

  const collection = await getProductsCollection();
  const _id = new ObjectId(id);

  const updates: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const name = sanitizeString(input.name);
    if (!name) {
      throw new Error("El nombre del producto es obligatorio");
    }
    updates.name = name;
  }

  if (input.factoryBarcode !== undefined) {
    const factoryBarcode = normalizeBarcode(input.factoryBarcode);
    if (!factoryBarcode) {
      throw new Error("El código de fábrica es obligatorio");
    }

    const duplicate = await collection.findOne({
      factoryBarcode,
      _id: { $ne: _id },
    });

    if (duplicate) {
      throw new Error(
        "Otro producto ya utiliza ese código de barras de fábrica"
      );
    }

    updates.factoryBarcode = factoryBarcode;
  }

  if (input.upcCode !== undefined) {
    const upcCode = normalizeBarcode(input.upcCode);
    if (!upcCode) {
      throw new Error("El código UPC es obligatorio");
    }

    const duplicate = await collection.findOne({
      upcCode,
      _id: { $ne: _id },
    });

    if (duplicate) {
      throw new Error("Otro producto ya utiliza ese código UPC");
    }

    updates.upcCode = upcCode;
  }

  if (Object.keys(updates).length === 0) {
    const existing = await collection.findOne({ _id });
    if (!existing) {
      throw new Error("Producto no encontrado");
    }
    return mapProductDocument(existing as ProductMongoDocument);
  }

  updates.updatedAt = new Date();

  const result = await collection.findOneAndUpdate(
    { _id },
    { $set: updates },
    { returnDocument: "after" }
  );

  const updatedDoc = result?.value;

  if (!updatedDoc) {
    throw new Error("Producto no encontrado");
  }

  return mapProductDocument(updatedDoc as ProductMongoDocument);
}

export async function deleteProduct(id: string) {
  if (!ObjectId.isValid(id)) {
    return false;
  }

  const collection = await getProductsCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}
