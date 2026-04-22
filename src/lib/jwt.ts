import crypto from "node:crypto";

const base64UrlDecode = (value: string) => {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(value.length + (4 - (value.length % 4)), "=");
  return Buffer.from(padded, "base64").toString("utf-8");
};

const base64UrlEncode = (value: string) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const toUnixSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

type SignPayload = Record<string, string | number | boolean>;

export const signJwtHs256 = (payload: SignPayload, secret: string): string => {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const content = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto.createHmac("sha256", secret).update(content).digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${content}.${signature}`;
};

export const buildTenantAccessToken = (input: {
  tenantId: string;
  userId: string;
  role: string;
  expiresInSeconds?: number;
}) => {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  const now = new Date();
  const exp = toUnixSeconds(new Date(now.getTime() + (input.expiresInSeconds ?? 60 * 60 * 8) * 1000));

  return signJwtHs256(
    {
      tenantId: input.tenantId,
      userId: input.userId,
      role: input.role,
      iat: toUnixSeconds(now),
      exp
    },
    secret
  );
};

export type JwtPayload = {
  tenantId: string;
  userId: string;
  role: string;
  iat: number;
  exp: number;
};

export const verifyAndDecodeJwt = (token: string, secret: string): JwtPayload => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const [encodedHeader, encodedPayload, providedSignature] = parts;
  const content = `${encodedHeader}.${encodedPayload}`;

  // Verify signature
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(content)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const a = Buffer.from(providedSignature);
  const b = Buffer.from(expectedSignature);
  const signaturesMatch =
    a.length === b.length &&
    crypto.timingSafeEqual(a, b);
  if (!signaturesMatch) {
    throw new Error("Invalid JWT signature");
  }

  // Decode payload
  const decodedPayload = JSON.parse(base64UrlDecode(encodedPayload)) as JwtPayload;

  // Check expiration
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (decodedPayload.exp < nowSeconds) {
    throw new Error("JWT token expired");
  }

  return decodedPayload;
};
