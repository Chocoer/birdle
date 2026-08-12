import bcrypt from 'bcryptjs';
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { db } from '../db/index.js';
import { getRedis } from '../redis.js';
import { AUTH_COOKIE, signToken, verifyToken } from './jwt.js';

const USERNAME_RE = /^[\w一-龥-]{2,16}$/;
const GUEST_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

/** 每 IP 每分钟 10 次：生产用 Redis 分钟桶，本地用内存滑动窗口。 */
const hits = new Map<string, number[]>();
async function rateLimited(ip: string): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    const key = `birdle:auth-rate:${ip}:${Math.floor(Date.now() / 60_000)}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    return count > 10;
  }
  const now = Date.now();
  const window = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  window.push(now);
  hits.set(ip, window);
  if (hits.size > 10_000) hits.clear(); // 防内存膨胀的粗处理
  return window.length > 10;
}

function setAuthCookie(res: Response, uid: number): void {
  res.cookie(AUTH_COOKIE, signToken(uid), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 3600 * 1000,
  });
}

/** 从 cookie 解析当前登录用户身份（'u_<id>'），未登录返回 null */
export function authIdentity(req: Request): string | null {
  const token = req.cookies?.[AUTH_COOKIE];
  if (typeof token !== 'string' || !token) return null;
  const uid = verifyToken(token);
  return uid == null ? null : `u_${uid}`;
}

export const authRouter = Router();

/** 只对注册/登录（爆破目标）限流 */
function guard(req: Request, res: Response, next: NextFunction): void {
  void rateLimited(req.ip ?? 'unknown')
    .then((limited) => {
      if (limited) res.status(429).json({ error: 'rate_limited' });
      else next();
    })
    .catch(next);
}

function parseBody(req: Request): { username: string; password: string; guestId?: string } | null {
  const { username, password, guestId } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) return null;
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) return null;
  if (guestId !== undefined && (typeof guestId !== 'string' || !GUEST_ID_RE.test(guestId))) return null;
  return { username, password, guestId: guestId as string | undefined };
}

async function mergeAndRespond(res: Response, uid: number, username: string, guestId?: string) {
  let merged = 0;
  if (guestId) merged = await db.mergeGames(guestId, `u_${uid}`);
  setAuthCookie(res, uid);
  res.json({ user: { username }, merged });
}

authRouter.post('/register', guard, async (req, res) => {
  const body = parseBody(req);
  if (!body) return res.status(400).json({ error: 'invalid_credentials' });
  const hash = await bcrypt.hash(body.password, 10);
  const user = await db.createUser(body.username, hash);
  if (!user) return res.status(409).json({ error: 'username_taken' });
  await mergeAndRespond(res, user.id, user.username, body.guestId);
});

authRouter.post('/login', guard, async (req, res) => {
  const body = parseBody(req);
  if (!body) return res.status(400).json({ error: 'invalid_credentials' });
  const user = await db.findUser(body.username);
  // 用户不存在时也跑一次 bcrypt，避免时间侧漏
  const ok = await bcrypt.compare(body.password, user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
  if (!user || !ok) return res.status(401).json({ error: 'wrong_credentials' });
  await mergeAndRespond(res, user.id, user.username, body.guestId);
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE);
  res.json({ ok: true });
});

authRouter.get('/me', async (req, res) => {
  const token = req.cookies?.[AUTH_COOKIE];
  const uid = typeof token === 'string' && token ? verifyToken(token) : null;
  if (uid == null) return res.json({ user: null });
  const user = await db.findUserById(uid);
  res.json({ user: user ? { username: user.username } : null });
});
