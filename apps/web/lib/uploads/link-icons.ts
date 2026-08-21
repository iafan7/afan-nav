import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { ServiceError } from "@/lib/services/categories";
import { LINK_ICON_STORED_NAME, isUploadedLinkIconPath } from "@/lib/uploads/link-icon-path";

export { isUploadedLinkIconPath };
export const LINK_ICON_MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED: Record<string, { ext: string; mimes: Set<string> }> = {
  png: { ext: "png", mimes: new Set(["image/png"]) },
  jpg: { ext: "jpg", mimes: new Set(["image/jpeg"]) },
  jpeg: { ext: "jpg", mimes: new Set(["image/jpeg"]) },
  webp: { ext: "webp", mimes: new Set(["image/webp"]) },
};

export function getDataRoot() {
  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "linknest.db");
  return path.dirname(path.resolve(dbPath));
}

export function getLinkIconsDir() {
  return path.join(getDataRoot(), "uploads", "link-icons");
}

export function ensureLinkIconsDir() {
  const dir = getLinkIconsDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function extensionOf(filename: string) {
  const base = path.basename(filename).toLowerCase();
  const idx = base.lastIndexOf(".");
  if (idx <= 0 || idx === base.length - 1) return "";
  return base.slice(idx + 1);
}

export function resolveSafeLinkIconPath(filename: string) {
  const base = path.basename(filename);
  if (!LINK_ICON_STORED_NAME.test(base)) {
    throw new ServiceError("非法文件名", 400);
  }
  const dir = path.resolve(getLinkIconsDir());
  const full = path.resolve(dir, base);
  if (!full.startsWith(dir + path.sep)) {
    throw new ServiceError("非法路径", 400);
  }
  return full;
}

export type SavedLinkIcon = {
  filename: string;
  url: string;
};

export async function saveLinkIconUpload(file: File): Promise<SavedLinkIcon> {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new ServiceError("请选择图片文件", 400);
  }
  if (file.size <= 0) {
    throw new ServiceError("文件为空", 400);
  }
  if (file.size > LINK_ICON_MAX_BYTES) {
    throw new ServiceError("图片不能超过 2MB", 400);
  }

  const extKey = extensionOf(file.name || "");
  const rule = ALLOWED[extKey];
  if (!rule) {
    throw new ServiceError("仅支持 PNG、JPG、WEBP", 400);
  }

  const mime = (file.type || "").toLowerCase();
  if (!rule.mimes.has(mime)) {
    throw new ServiceError("文件类型与扩展名不匹配", 400);
  }

  const filename = `${nanoid(16)}.${rule.ext}`;
  const dir = ensureLinkIconsDir();
  const full = path.join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > LINK_ICON_MAX_BYTES) {
    throw new ServiceError("图片不能超过 2MB", 400);
  }
  fs.writeFileSync(full, buffer);

  return {
    filename,
    url: `/api/uploads/link-icons/${filename}`,
  };
}

export function contentTypeForLinkIcon(filename: string) {
  const ext = extensionOf(filename);
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}
