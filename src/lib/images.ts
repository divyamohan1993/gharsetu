import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config.js";
import { newId } from "./id.js";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export type SavedImage = { id: string; url: string };

export async function saveImage(buf: Buffer, mimeType: string): Promise<SavedImage> {
  if (!ALLOWED.has(mimeType)) {
    throw new Error(`Unsupported image type: ${mimeType}`);
  }
  if (buf.length > MAX_BYTES) {
    throw new Error("Image too large");
  }
  const id = newId();
  const out = join(config.UPLOADS_DIR, `${id}.webp`);
  const webp = await sharp(buf, { failOn: "none" })
    .rotate()
    .resize({ width: 1600, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();
  await writeFile(out, webp);
  return { id, url: `/uploads/${id}.webp` };
}
