import { MongoClient, MongoClientOptions } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "KelloggsBD_react";

if (!uri) {
  throw new Error(
    "MONGODB_URI no está configurado. Asegúrate de definirlo en tu archivo .env.local"
  );
}

const options: MongoClientOptions = {
  maxPoolSize: 10,
};

const globalForMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

let clientPromise: Promise<MongoClient>;

if (globalForMongo._mongoClientPromise) {
  clientPromise = globalForMongo._mongoClientPromise;
} else {
  const client = new MongoClient(uri, options);
  globalForMongo._mongoClientPromise = client.connect();
  clientPromise = globalForMongo._mongoClientPromise;
}

export async function getMongoClient(): Promise<MongoClient> {
  return clientPromise;
}

export async function getMongoDatabase() {
  const client = await getMongoClient();
  return client.db(dbName);
}

export async function getUsersCollection() {
  const database = await getMongoDatabase();
  const collectionName = process.env.MONGODB_COLLECTION_USERS ?? "Usuarios";
  return database.collection(collectionName);
}

export async function getStoresCollection() {
  const database = await getMongoDatabase();
  const collectionName = process.env.MONGODB_COLLECTION_STORES ?? "Tiendas";
  return database.collection(collectionName);
}

export async function getStoreBackupsCollection() {
  const database = await getMongoDatabase();
  const collectionName =
    process.env.MONGODB_COLLECTION_STORE_BACKUPS ?? "TiendasBackups";
  return database.collection(collectionName);
}

export async function getRoutesCollection() {
  const database = await getMongoDatabase();
  const collectionName = process.env.MONGODB_COLLECTION_ROUTES ?? "Rutas";
  return database.collection(collectionName);
}

export async function getFormTemplatesCollection() {
  const database = await getMongoDatabase();
  const collectionName =
    process.env.MONGODB_COLLECTION_FORM_TEMPLATES ?? "FormulariosBitacora";
  return database.collection(collectionName);
}

export async function getVisitLogsCollection() {
  const database = await getMongoDatabase();
  const collectionName =
    process.env.MONGODB_COLLECTION_VISIT_LOGS ?? "BitacoraVisitas";
  return database.collection(collectionName);
}

export async function getProductsCollection() {
  const database = await getMongoDatabase();
  const collectionName = process.env.MONGODB_COLLECTION_PRODUCTS ?? "Productos";
  return database.collection(collectionName);
}

export async function getWorkgroupsCollection() {
  const database = await getMongoDatabase();
  const collectionName =
    process.env.MONGODB_COLLECTION_WORKGROUPS ?? "GruposTrabajo";
  return database.collection(collectionName);
}

export default clientPromise;
