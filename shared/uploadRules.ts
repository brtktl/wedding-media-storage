export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = "100MB";

export type UploadFileMetadata = {
  name: string;
  type: string;
  size: number;
};

export type FileValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function sanitizeGuestName(value: string): string {
  const safeName = value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return safeName || "guest";
}

export function sanitizeFileName(value: string): string {
  const fileName = value.split(/[\\/]/).pop()?.trim() ?? "";
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+|\.+$/g, "")
    .replace(/^-+|-+$/g, "");

  return normalized || "upload";
}

export function isSupportedMediaType(type: string): boolean {
  return type.startsWith("image/") || type.startsWith("video/");
}

export function validateUploadFile(file: UploadFileMetadata): FileValidationResult {
  if (!file.name.trim()) {
    return { ok: false, reason: "File name is missing." };
  }

  if (!isSupportedMediaType(file.type)) {
    return { ok: false, reason: "Only photos and videos can be uploaded." };
  }

  if (file.size <= 0) {
    return { ok: false, reason: "This file appears to be empty." };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, reason: `Files must be ${MAX_FILE_SIZE_LABEL} or smaller.` };
  }

  return { ok: true };
}

export function formatObjectTimestamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = padDatePart(date.getUTCMonth() + 1);
  const day = padDatePart(date.getUTCDate());
  const hours = padDatePart(date.getUTCHours());
  const minutes = padDatePart(date.getUTCMinutes());
  const seconds = padDatePart(date.getUTCSeconds());

  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

export function createR2ObjectKey(
  guestName: string,
  fileName: string,
  date = new Date(),
): string {
  return `guests/${sanitizeGuestName(guestName)}/${formatObjectTimestamp(date)}-${sanitizeFileName(fileName)}`;
}

function padDatePart(value: number): string {
  return value.toString().padStart(2, "0");
}
