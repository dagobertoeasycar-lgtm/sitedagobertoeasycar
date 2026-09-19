import assert from "node:assert/strict";
import test from "node:test";
import {
  adminImageContentTypes,
  adminImageMaxBytes,
  adminVideoContentTypes,
  adminVideoMaxBytes,
  isVercelBlobUrl,
  safeUploadName,
} from "../src/lib/media-upload.ts";
import { getVercelBlobToken, hasVercelBlobCredentials } from "../src/lib/vercel-blob-token.ts";

test("validação aceita apenas mídia e limites definidos para o painel", () => {
  assert.deepEqual([...adminImageContentTypes], ["image/jpeg", "image/png", "image/webp", "image/avif"]);
  assert.deepEqual([...adminVideoContentTypes], ["video/mp4", "video/webm", "video/quicktime"]);
  assert.equal(adminImageMaxBytes, 25 * 1024 * 1024);
  assert.equal(adminVideoMaxBytes, 500 * 1024 * 1024);
});

test("endereço de upload precisa ser HTTPS, do Vercel Blob e da pasta esperada", () => {
  const image = "https://autodrive.public.blob.vercel-storage.com/vehicle-images/manual/foto.jpg";
  const video = "https://autodrive.public.blob.vercel-storage.com/vehicle-videos/default/video.mp4";
  assert.equal(isVercelBlobUrl(image, "vehicle-images"), true);
  assert.equal(isVercelBlobUrl(video, "vehicle-videos"), true);
  assert.equal(isVercelBlobUrl(video, "vehicle-images"), false);
  assert.equal(isVercelBlobUrl("https://blob.vercel-storage.com.evil.test/vehicle-images/a.jpg"), false);
  assert.equal(isVercelBlobUrl("javascript:alert(1)"), false);
});

test("nome enviado perde acentos, espaços e caracteres inseguros", () => {
  assert.equal(safeUploadName("Foto São João (01).JPG", "foto.jpg"), "Foto-Sao-Joao-01-.JPG");
  assert.equal(safeUploadName("...", "foto.jpg"), "foto.jpg");
});

test("credencial Blob aceita o nome padrão e nomes prefixados pela Vercel", () => {
  assert.equal(getVercelBlobToken({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_padrao" }), "vercel_blob_rw_padrao");
  assert.equal(getVercelBlobToken({ AUTODRIVE_READ_WRITE_TOKEN: "vercel_blob_rw_prefixado" }), "vercel_blob_rw_prefixado");
  assert.equal(getVercelBlobToken({ OTHER_READ_WRITE_TOKEN: "token-invalido" }), null);
  assert.equal(getVercelBlobToken({}), null);
  assert.equal(hasVercelBlobCredentials({ BLOB_STORE_ID: "store_autodrive" }), true);
  assert.equal(hasVercelBlobCredentials({}), false);
});
