import assert from "node:assert/strict";
import test from "node:test";
import { orderVehicleGallery, parseGalleryMedia } from "../src/lib/vehicle-gallery-media.ts";

const VIDEO = "https://autodrive.public.blob.vercel-storage.com/vehicle-videos/default/apresentacao.mp4";
const FOTO_1 = "https://cdn.example.com/carro-1.jpg";
const FOTO_2 = "https://cdn.example.com/carro-2.jpg";

test("vídeo configurado ocupa sempre a primeira posição antes das fotos", () => {
  assert.deepEqual(orderVehicleGallery([FOTO_1, FOTO_2], "/em-breve.png", VIDEO), [
    { type: "video", url: VIDEO },
    { type: "image", url: FOTO_1 },
    { type: "image", url: FOTO_2 },
  ]);
});

test("vídeo que já veio na galeria também é movido para o início sem duplicar", () => {
  assert.deepEqual(
    orderVehicleGallery(
      [{ type: "image", url: FOTO_1 }, { type: "video", url: VIDEO }, { type: "image", url: FOTO_2 }],
      "/em-breve.png",
      VIDEO,
    ),
    [
      { type: "video", url: VIDEO },
      { type: "image", url: FOTO_1 },
      { type: "image", url: FOTO_2 },
    ],
  );
});

test("sem fotos o player continua primeiro e a imagem de fallback vem depois", () => {
  assert.deepEqual(orderVehicleGallery([], "/em-breve.png", VIDEO), [
    { type: "video", url: VIDEO },
    { type: "image", url: "/em-breve.png" },
  ]);
});

test("mídia inválida cai na imagem Em breve", () => {
  assert.deepEqual(parseGalleryMedia([{ url: "" }, null], "/em-breve.png"), [
    { type: "image", url: "/em-breve.png" },
  ]);
});
