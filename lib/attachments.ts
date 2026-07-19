import "server-only";

import { fileTypeFromBuffer } from "file-type";

import type { AttachmentMeta } from "@/lib/db/schema";
import { stripControl } from "@/lib/strings";

/**
 * Attachment validation for the reply endpoint. The admin is the only
 * uploader, so this is less about malice and more about refusing accidents
 * loudly: content types come from MAGIC BYTES (file-type), never from the
 * browser's declared MIME or the extension, and the caps keep the final
 * base64-inflated message (~+37%) under Proton's 25 MB ceiling.
 */

import {
  MAX_FILE_BYTES,
  MAX_FILES,
  MAX_TOTAL_BYTES,
} from "@/lib/attachment-limits";

export { MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES };

/** Detectable-by-signature types the panel will attach. */
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/zip",
  // OOXML trio — file-type tells them apart from a bare zip.
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

/**
 * Plain-text formats have no magic bytes; they're allowed only when the
 * extension claims text AND the bytes really are clean UTF-8.
 */
const TEXT_EXT = new Map([
  [".txt", "text/plain"],
  [".csv", "text/csv"],
  [".md", "text/markdown"],
]);

function isPlainUtf8(buf: Buffer): boolean {
  if (buf.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf);
    return true;
  } catch {
    return false;
  }
}

/** Control chars and path/FS-special characters out; keep the TAIL (extension). */
function safeName(name: string): string {
  const cleaned = stripControl(name)
    .replace(/[/\\:*?"<>|]/g, "_")
    .trim();
  return cleaned.slice(-120) || "zalacznik";
}

export type ValidAttachments = {
  ok: true;
  /** What nodemailer sends. */
  list: { filename: string; content: Buffer; contentType: string }[];
  /** What the DB remembers — names and sizes, never bytes. */
  meta: AttachmentMeta[];
};
export type InvalidAttachments = { ok: false; status: 400 | 413 | 415 };

export async function validateAttachments(
  files: File[],
): Promise<ValidAttachments | InvalidAttachments> {
  if (files.length > MAX_FILES) return { ok: false, status: 400 };

  let total = 0;
  const list: ValidAttachments["list"] = [];
  const meta: AttachmentMeta[] = [];

  for (const file of files) {
    if (file.size === 0) return { ok: false, status: 400 };
    if (file.size > MAX_FILE_BYTES) return { ok: false, status: 413 };
    total += file.size;
    if (total > MAX_TOTAL_BYTES) return { ok: false, status: 413 };

    const buf = Buffer.from(await file.arrayBuffer());

    const detected = await fileTypeFromBuffer(buf);
    let contentType: string | null = null;
    if (detected) {
      if (ALLOWED_MIME.has(detected.mime)) contentType = detected.mime;
    } else {
      const dot = file.name.lastIndexOf(".");
      const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
      const textType = TEXT_EXT.get(ext);
      if (textType && isPlainUtf8(buf)) contentType = textType;
    }
    if (!contentType) return { ok: false, status: 415 };

    const filename = safeName(file.name);
    list.push({ filename, content: buf, contentType });
    meta.push({ name: filename, size: buf.length, type: contentType });
  }

  return { ok: true, list, meta };
}
