import express from 'express';
import cookieParser from 'cookie-parser';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// 必须在动态导入业务模块前设置：让 db 选择内存 SQLite
process.env.DB_PATH = ':memory:';
delete process.env.DATABASE_URL;

let server: Server;
let base: string;
type Db = import('../db/index.js').Db;
let db: Db;

function cookieOf(res: Response): string {
  return res.headers.get('set-cookie')?.split(';')[0] ?? '';
}

beforeAll(async () => {
  const { authRouter } = await import('./routes.js');
  ({ db } = await import('../db/index.js'));
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await db.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const post = (path: string, body: unknown, cookie?: string) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });

describe('认证', () => {
  it('注册 → me → 退出 → 登录 全流程', async () => {
    // 注册
    const reg = await post('/api/auth/register', {
      username: '测试玩家',
      password: 'password123',
      guestId: 'guest-token-0001',
    });
    expect(reg.status).toBe(200);
    const regBody = await reg.json();
    expect(regBody.user.username).toBe('测试玩家');
    const cookie = cookieOf(reg);
    expect(cookie).toContain('birdle_token=');

    // me（带 cookie）
    const me = await fetch(base + '/api/auth/me', { headers: { Cookie: cookie } });
    expect((await me.json()).user.username).toBe('测试玩家');

    // me（无 cookie）
    const anon = await fetch(base + '/api/auth/me');
    expect((await anon.json()).user).toBeNull();

    // 退出后 me 应为空
    const out = await post('/api/auth/logout', {}, cookie);
    expect(out.status).toBe(200);

    // 登录
    const login = await post('/api/auth/login', { username: '测试玩家', password: 'password123' });
    expect(login.status).toBe(200);
    expect(cookieOf(login)).toContain('birdle_token=');
  });

  it('重复用户名 409、错误密码 401、非法输入 400', async () => {
    const dup = await post('/api/auth/register', { username: '测试玩家', password: 'password123' });
    expect(dup.status).toBe(409);
    expect((await dup.json()).error).toBe('username_taken');

    const wrong = await post('/api/auth/login', { username: '测试玩家', password: 'wrong-password' });
    expect(wrong.status).toBe(401);

    const bad1 = await post('/api/auth/register', { username: 'a', password: 'password123' });
    expect(bad1.status).toBe(400);
    const bad2 = await post('/api/auth/register', { username: 'validname', password: 'short' });
    expect(bad2.status).toBe(400);
  });

  it('登录时并入游客战绩', async () => {
    const guest = 'guest-token-merge';
    await db.recordGame({
      guestId: guest,
      difficulty: 'easy',
      birdId: 1,
      won: true,
      guessCount: 3,
      date: '2026-08-10',
    });

    const reg = await post('/api/auth/register', {
      username: '合并测试',
      password: 'password123',
      guestId: guest,
    });
    expect(reg.status).toBe(200);
    expect((await reg.json()).merged).toBe(1);

    // 游客身份战绩已清零，账号身份有一条
    const guestStats = await db.getStats(guest);
    expect(guestStats.played).toBe(0);
    const cookie = cookieOf(reg);
    const meBody = await (await fetch(base + '/api/auth/me', { headers: { Cookie: cookie } })).json();
    expect(meBody.user.username).toBe('合并测试');
  });
});
