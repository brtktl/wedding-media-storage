import { MAX_FILE_SIZE_BYTES } from "../shared/uploadRules";
import { handleRequest, type Env } from "./index";

const env: Env = {
  ASSETS: {
    fetch: () => Promise.resolve(new Response("asset")),
  } as unknown as Fetcher,
  R2_ACCOUNT_ID: "account",
  R2_BUCKET_NAME: "bucket",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  ALLOWED_ORIGIN: "https://example.com",
};

const signer = vi.fn(async ({ key, contentType }) => ({
  url: `https://signed.example.com/${key}`,
  method: "PUT" as const,
  headers: {
    "content-type": contentType,
  },
}));

describe("presign endpoint", () => {
  beforeEach(() => {
    signer.mockClear();
  });

  it("rejects missing guest names", async () => {
    const response = await handleRequest(
      jsonRequest({ guestName: "", files: [{ name: "photo.jpg", type: "image/jpeg", size: 1 }] }),
      env,
      signer,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Misafir adı gerekli." });
  });

  it("rejects unsupported file types", async () => {
    const response = await handleRequest(
      jsonRequest({ guestName: "Jane", files: [{ name: "doc.pdf", type: "application/pdf", size: 1 }] }),
      env,
      signer,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Yalnızca fotoğraf ve video yüklenebilir.",
    });
  });

  it("rejects oversized files", async () => {
    const response = await handleRequest(
      jsonRequest({
        guestName: "Jane",
        files: [{ name: "clip.mov", type: "video/quicktime", size: MAX_FILE_SIZE_BYTES + 1 }],
      }),
      env,
      signer,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Dosyalar 100MB veya daha küçük olmalı." });
  });

  it("returns upload descriptors for valid files", async () => {
    const response = await handleRequest(
      jsonRequest({
        guestName: "Jane Doe",
        files: [{ name: "photo.jpg", type: "image/jpeg", size: 1 }],
      }),
      env,
      signer,
    );
    const body = (await response.json()) as {
      uploads: Array<{
        originalName: string;
        key: string;
        method: string;
        headers: Record<string, string>;
      }>;
    };

    expect(response.status).toBe(200);
    expect(body.uploads).toHaveLength(1);
    expect(body.uploads[0]).toMatchObject({
      originalName: "photo.jpg",
      method: "PUT",
      headers: { "content-type": "image/jpeg" },
    });
    expect(body.uploads[0].key).toMatch(/^guests\/jane-doe\/\d{8}T\d{6}-photo\.jpg$/);
    expect(signer).toHaveBeenCalledTimes(1);
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("https://example.com/api/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
