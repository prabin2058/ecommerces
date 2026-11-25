import fs from "fs/promises";
import path from "path";
import url from "url";
import config from "../config.js";
import { hmac, safeEqual, randomToken } from "../lib/util.js";
import { detectImageType, stripMetadata } from "../lib/imageFile.js";
import { badRequest, unauthorized, AppError } from "../lib/errors.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.join(__dirname, "../../public/assets/images/uploads");

// Pre-signed upload: the browser PUTs bytes straight to the storage URL with a short-lived signature,
// mirroring S3 pre-signed URLs. In production point uploadUrl at S3/R2 and drop the local handler.
export function presign({ filename = "", contentType = "", size = 0 }, user) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) throw badRequest("UNSUPPORTED_TYPE", "Use JPG, PNG or WebP");
  if (size > config.upload.maxBytes) throw badRequest("FILE_TOO_LARGE", "Images must be 5 MB or less");
  const key = `${Date.now().toString(36)}-${randomToken(9)}`;
  const expires = Date.now() + 5 * 60_000;
  const sig = hmac(config.uploadSecret, `${key}.${expires}.${user.id}`);
  return { key, uploadUrl: `/api/admin/uploads/${key}?expires=${expires}&sig=${sig}`, expires, originalName: String(filename).slice(0, 100) };
}

export async function receiveUpload(key, { expires, sig }, buffer, user) {
  if (!/^[a-z0-9]+-[\w-]+$/i.test(key)) throw badRequest("INVALID_KEY", "Invalid upload key");
  if (!expires || Number(expires) < Date.now()) throw unauthorized("Upload URL expired");
  if (!safeEqual(sig || "", hmac(config.uploadSecret, `${key}.${expires}.${user.id}`))) throw unauthorized("Invalid upload signature");
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw badRequest("EMPTY_FILE", "No file received");
  if (buffer.length > config.upload.maxBytes) throw new AppError(413, "FILE_TOO_LARGE", "Images must be 5 MB or less");
  const type = detectImageType(buffer);
  if (!type) throw badRequest("UNSUPPORTED_TYPE", "File is not a real JPG, PNG or WebP image");
  const clean = stripMetadata(buffer, type);
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${key}.${type}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), clean, { flag: "wx" });
  return { url: `/images/uploads/${name}`, bytes: clean.length, type };
}
