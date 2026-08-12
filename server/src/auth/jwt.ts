import jwt from 'jsonwebtoken';

const DEV_SECRET = 'birdle-dev-secret-do-not-use-in-prod';
export const JWT_SECRET = process.env.JWT_SECRET ?? DEV_SECRET;

if (process.env.NODE_ENV === 'production' && Buffer.byteLength(process.env.JWT_SECRET ?? '') < 32) {
  throw new Error('生产环境必须配置至少 32 字节的 JWT_SECRET');
}

export const AUTH_COOKIE = 'birdle_token';
const MAX_AGE_S = 30 * 24 * 3600; // 30 天

export function signToken(uid: number): string {
  return jwt.sign({ uid }, JWT_SECRET, { expiresIn: MAX_AGE_S });
}

export function verifyToken(token: string): number | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { uid?: number };
    return typeof payload.uid === 'number' ? payload.uid : null;
  } catch {
    return null;
  }
}
