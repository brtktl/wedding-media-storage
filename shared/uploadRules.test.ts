import {
  MAX_FILE_SIZE_BYTES,
  createR2ObjectKey,
  sanitizeFileName,
  sanitizeGuestName,
  validateUploadFile,
} from "./uploadRules";

describe("upload rules", () => {
  it("sanitizes guest names for folder paths", () => {
    expect(sanitizeGuestName("  Jane & John Doe  ")).toBe("jane-john-doe");
    expect(sanitizeGuestName("Çağla Öz")).toBe("cagla-oz");
    expect(sanitizeGuestName("   ")).toBe("guest");
  });

  it("sanitizes file names while preserving extensions", () => {
    expect(sanitizeFileName("../IMG 001.final.JPG")).toBe("IMG-001.final.JPG");
    expect(sanitizeFileName("💍")).toBe("upload");
  });

  it("creates stable R2 object keys", () => {
    const date = new Date("2026-05-26T16:55:00Z");

    expect(createR2ObjectKey("Jane Doe", "photo one.jpg", date)).toBe(
      "guests/jane-doe/20260526T165500-photo-one.jpg",
    );
  });

  it("validates supported upload metadata", () => {
    expect(validateUploadFile({ name: "photo.jpg", type: "image/jpeg", size: 1 })).toEqual({
      ok: true,
    });
    expect(validateUploadFile({ name: "clip.mov", type: "video/quicktime", size: 12 })).toEqual({
      ok: true,
    });
  });

  it("rejects unsupported and oversized files", () => {
    expect(validateUploadFile({ name: "notes.pdf", type: "application/pdf", size: 1 })).toEqual({
      ok: false,
      reason: "Only photos and videos can be uploaded.",
    });
    expect(
      validateUploadFile({
        name: "huge.mov",
        type: "video/quicktime",
        size: MAX_FILE_SIZE_BYTES + 1,
      }),
    ).toEqual({ ok: false, reason: "Files must be 100MB or smaller." });
  });
});
