import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

const bucketName = process.env.R2_BUCKET_NAME;
const endpoint = process.env.R2_ENDPOINT;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const publicBaseUrl =
  process.env.R2_PUBLIC_BASE_URL ??
  (endpoint && bucketName
    ? `${endpoint.replace(/\/$/, "")}/${bucketName}`
    : undefined);

let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (!bucketName || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Cloudflare R2 no está configurado. Define R2_BUCKET_NAME, R2_ENDPOINT, R2_ACCESS_KEY_ID y R2_SECRET_ACCESS_KEY."
    );
  }

  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: endpoint.replace(/\/$/, ""),
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  return cachedClient;
}

function resolveExtension(
  filename: string | undefined,
  mimeType: string | undefined
) {
  const nameExtension =
    filename && filename.includes(".")
      ? filename.substring(filename.lastIndexOf(".")).toLowerCase()
      : "";
  const mimeExtension =
    mimeType && mimeType.includes("/")
      ? `.${mimeType.split("/").pop()?.toLowerCase()}`
      : "";

  if (nameExtension) {
    return nameExtension;
  }

  if (mimeExtension && mimeExtension !== ".octet-stream") {
    return mimeExtension;
  }

  return "";
}

function buildObjectKey(
  filename: string | undefined,
  mimeType: string | undefined
) {
  const extension = resolveExtension(filename, mimeType);
  return `products/${randomUUID()}${extension}`;
}

function buildPublicUrl(key: string) {
  if (publicBaseUrl) {
    const base = publicBaseUrl.replace(/\/$/, "");
    return `${base}/${key}`;
  }

  if (!endpoint || !bucketName) {
    throw new Error(
      "No se pudo construir la URL pública para el objeto en R2."
    );
  }

  const base = endpoint.replace(/\/$/, "");
  return `${base}/${bucketName}/${key}`;
}

export async function uploadProductImage(file: File) {
  const client = getClient();
  const key = buildObjectKey(file.name, file.type);
  const body = Buffer.from(await file.arrayBuffer());

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: file.type || "application/octet-stream",
    })
  );

  return {
    key,
    url: buildPublicUrl(key),
  };
}

export async function deleteProductImage(key: string) {
  try {
    const client = getClient();
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
  } catch (error) {
    console.error(`No se pudo eliminar la imagen ${key} en R2:`, error);
  }
}
