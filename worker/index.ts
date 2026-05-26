import { createR2ObjectKey, validateUploadFile, type UploadFileMetadata } from "../shared/uploadRules";
import { createPresignedR2PutUrl } from "./r2Signer";

export type Env = {
  ASSETS: Fetcher;
  R2_ACCOUNT_ID: string;
  R2_BUCKET_NAME: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  ALLOWED_ORIGIN: string;
};

type PresignRequestBody = {
  guestName?: unknown;
  files?: unknown;
};

type PresignUpload = {
  originalName: string;
  key: string;
  url: string;
  method: "PUT";
  headers: {
    "content-type": string;
  };
};

type Signer = typeof createPresignedR2PutUrl;

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};

export async function handleRequest(
  request: Request,
  env: Env,
  signer: Signer = createPresignedR2PutUrl,
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }

  if (url.pathname === "/api/presign") {
    return handlePresign(request, env, signer);
  }

  return env.ASSETS.fetch(request);
}

async function handlePresign(request: Request, env: Env, signer: Signer): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Bu yönteme izin verilmiyor." }, env, 405);
  }

  let body: PresignRequestBody;
  try {
    body = (await request.json()) as PresignRequestBody;
  } catch {
    return jsonResponse({ error: "İstek gövdesi geçerli JSON olmalı." }, env, 400);
  }

  if (typeof body.guestName !== "string" || !body.guestName.trim()) {
    return jsonResponse({ error: "Misafir adı gerekli." }, env, 400);
  }

  if (!Array.isArray(body.files) || body.files.length === 0) {
    return jsonResponse({ error: "En az bir dosya gerekli." }, env, 400);
  }

  const uploadFiles: UploadFileMetadata[] = [];
  for (const file of body.files.map(normalizeFileMetadata)) {
    if (!file.ok) {
      return jsonResponse({ error: file.reason }, env, 400);
    }

    uploadFiles.push(file.file);
  }
  const uploads: PresignUpload[] = await Promise.all(
    uploadFiles.map(async (file) => {
      const key = createR2ObjectKey(body.guestName as string, file.name);
      const signed = await signer({
        accountId: env.R2_ACCOUNT_ID,
        bucketName: env.R2_BUCKET_NAME,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        key,
        contentType: file.type,
      });

      return {
        originalName: file.name,
        key,
        ...signed,
      };
    }),
  );

  return jsonResponse({ uploads }, env);
}

function normalizeFileMetadata(
  value: unknown,
): { ok: true; file: UploadFileMetadata } | { ok: false; reason: string } {
  if (typeof value !== "object" || value === null) {
    return { ok: false, reason: "Her dosyada ad, tür ve boyut bilgisi olmalı." };
  }

  const candidate = value as Partial<UploadFileMetadata>;
  if (
    typeof candidate.name !== "string" ||
    typeof candidate.type !== "string" ||
    typeof candidate.size !== "number"
  ) {
    return { ok: false, reason: "Her dosyada ad, tür ve boyut bilgisi olmalı." };
  }

  const file = {
    name: candidate.name,
    type: candidate.type,
    size: candidate.size,
  };
  const validation = validateUploadFile(file);

  if (!validation.ok) {
    return { ok: false, reason: validation.reason };
  }

  return { ok: true, file };
}

function jsonResponse(body: unknown, env: Env, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(env),
    },
  });
}

function corsHeaders(env: Env): HeadersInit {
  return {
    "access-control-allow-origin": env.ALLOWED_ORIGIN,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "vary": "Origin",
  };
}
