const AWS_ALGORITHM = "AWS4-HMAC-SHA256";
const AWS_SERVICE = "s3";
const AWS_REGION = "auto";
const PRESIGN_EXPIRES_SECONDS = 15 * 60;
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

export type R2PresignInput = {
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  key: string;
  contentType: string;
  now?: Date;
};

export type R2PresignedPut = {
  url: string;
  method: "PUT";
  headers: {
    "content-type": string;
  };
};

export async function createPresignedR2PutUrl(input: R2PresignInput): Promise<R2PresignedPut> {
  const now = input.now ?? new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const host = `${input.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${input.bucketName}/${encodeKeyPath(input.key)}`;
  const credentialScope = `${dateStamp}/${AWS_REGION}/${AWS_SERVICE}/aws4_request`;
  const credential = `${input.accessKeyId}/${credentialScope}`;
  const signedHeaders = "content-type;host";
  const params = new URLSearchParams({
    "X-Amz-Algorithm": AWS_ALGORITHM,
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": PRESIGN_EXPIRES_SECONDS.toString(),
    "X-Amz-SignedHeaders": signedHeaders,
  });
  const canonicalQueryString = sortQueryParams(params);
  const canonicalHeaders = `content-type:${input.contentType}\nhost:${host}\n`;
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    UNSIGNED_PAYLOAD,
  ].join("\n");
  const stringToSign = [
    AWS_ALGORITHM,
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = await getSignatureKey(input.secretAccessKey, dateStamp);
  const signature = await hmacHex(signingKey, stringToSign);

  params.set("X-Amz-Signature", signature);

  return {
    url: `https://${host}${canonicalUri}?${sortQueryParams(params)}`,
    method: "PUT",
    headers: {
      "content-type": input.contentType,
    },
  };
}

function encodeKeyPath(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function sortQueryParams(params: URLSearchParams): string {
  return Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

async function getSignatureKey(secretAccessKey: string, dateStamp: string): Promise<ArrayBuffer> {
  const dateKey = await hmacBytes(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = await hmacBytes(dateKey, AWS_REGION);
  const serviceKey = await hmacBytes(regionKey, AWS_SERVICE);

  return hmacBytes(serviceKey, "aws4_request");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textBytes(value));

  return toHex(digest);
}

async function hmacHex(key: string | ArrayBuffer, value: string): Promise<string> {
  return toHex(await hmacBytes(key, value));
}

async function hmacBytes(key: string | ArrayBuffer, value: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    typeof key === "string" ? textBytes(key) : key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return crypto.subtle.sign("HMAC", cryptoKey, textBytes(value));
}

function textBytes(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value);

  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
