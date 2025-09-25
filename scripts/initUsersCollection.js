// Script para inicializar la colección de usuarios con roles e índices básicos.
// Ejecuta: node --env-file=.env.local scripts/initUsersCollection.js

const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "KelloggsBD_react";
const collectionName = process.env.MONGODB_COLLECTION_USERS || "Usuarios";

if (!uri) {
  console.error(
    "❌ MONGODB_URI no está definido. Exporta las variables de entorno o usa --env-file=.env.local"
  );
  process.exit(1);
}

async function ensureIndexes(collection) {
  await collection.createIndex(
    { cedula: 1 },
    { unique: true, name: "uniq_cedula" }
  );
  await collection.createIndex(
    { email: 1 },
    { unique: true, name: "uniq_email" }
  );
  await collection.createIndex({ role: 1 }, { name: "idx_role" });
  await collection.createIndex({ active: 1 }, { name: "idx_active" });
}

async function upsertAdminUser(collection) {
  const adminCedula = "000000001";
  const adminEmail = "admin@kelloggsbd.local";
  const adminPassword = "Admin123!";

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await collection.updateOne(
    { cedula: adminCedula },
    {
      $setOnInsert: {
        cedula: adminCedula,
        nombre: "Administrador General",
        email: adminEmail,
        passwordHash,
        role: "admin",
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  console.log("✅ Usuario administrador por defecto disponible:");
  console.log(`   Cédula: ${adminCedula}`);
  console.log(`   Correo: ${adminEmail}`);
  console.log(`   Contraseña: ${adminPassword}`);
}

async function main() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("✅ Conectado a MongoDB");

    const db = client.db(dbName);

    const collections = await db
      .listCollections({ name: collectionName }, { nameOnly: true })
      .toArray();

    if (collections.length === 0) {
      await db.createCollection(collectionName);
      console.log(`✅ Colección '${collectionName}' creada`);
    } else {
      console.log(`ℹ️ Colección '${collectionName}' ya existe`);
    }

    const collection = db.collection(collectionName);

    await ensureIndexes(collection);
    console.log("✅ Índices creados o verificados");

    await upsertAdminUser(collection);
  } catch (error) {
    console.error("❌ Error durante la inicialización de la colección:", error);
  } finally {
    await client.close();
    console.log("🔒 Conexión cerrada");
  }
}

main();
