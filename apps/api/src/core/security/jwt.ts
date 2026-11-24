import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64').toString('utf8');
}

export function parseTtlToSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!match) return 900; // default 15m
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === 's') return amount;
  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 3600;
  return amount * 86400;
}

export function signAccessToken(
  user: { id: string; email: string },
  secret: string,
  ttlSeconds: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      iat: now,
      exp: now + ttlSeconds,
    } satisfies AccessTokenPayload),
  );

  const signingInput = `${header}.${payload}`;
  const signature = base64UrlEncode(
    createHmac('sha256', secret).update(signingInput).digest(),
  );
  return `${signingInput}.${signature}`;
}

export function verifyAccessToken(token: string, secret: string): AccessTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  if (!header || !payload || !signature) return null;

  const signingInput = `${header}.${payload}`;
  const expectedSig = base64UrlEncode(
    createHmac('sha256', secret).update(signingInput).digest(),
  );

  const expectedBuf = Buffer.from(expectedSig);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, actualBuf)) return null;

  try {
    const decoded = JSON.parse(base64UrlDecode(payload)) as AccessTokenPayload;
    if (!decoded.sub || !decoded.email || typeof decoded.exp !== 'number') {
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp <= now) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function generateOpaqueToken(): string {
  return randomBytes(48).toString('base64url');
}

export function sha256Hex(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
