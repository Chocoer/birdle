import { createAdapter } from '@socket.io/redis-adapter';
import cookieParser from 'cookie-parser';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server as IoServer } from 'socket.io';
import { authIdentity, authRouter } from './auth/routes.js';
import { db } from './db/index.js';
import { poolOf, revealAnswer, startGame, submitGuess } from './game/session.js';
import { attachGateway } from './mp/gateway.js';
import { getRedis } from './redis.js';
import type { Difficulty } from './types.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);

const GUEST_ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

function parseDifficulty(value: unknown): Difficulty | undefined {
  return DIFFICULTIES.includes(value as Difficulty) ? (value as Difficulty) : undefined;
}

function validGuestId(value: unknown): value is string {
  return typeof value === 'string' && GUEST_ID_RE.test(value);
}

type AsyncRoute = (req: Request, res: Response) => Promise<unknown>;
const asyncRoute =
  (route: AsyncRoute) => (req: Request, res: Response, next: NextFunction) => {
    void route(req, res).catch(next);
  };

// --- 鸟类搜索（仅返回名称，用于自动补全；可按难度池限定范围）---
app.get('/api/birds/search', (req, res) => {
  const query = String(req.query.q ?? '').trim().toLowerCase();
  if (!query) return res.json({ results: [] });
  const difficulty = req.query.difficulty === undefined ? undefined : parseDifficulty(req.query.difficulty);
  if (req.query.difficulty !== undefined && !difficulty) {
    return res.status(400).json({ error: 'invalid_difficulty' });
  }
  const results = (difficulty ? poolOf(difficulty) : poolOf('hard'))
    .filter(
      (bird) =>
        bird.name.includes(query) ||
        bird.pinyin.startsWith(query) ||
        bird.abbr.startsWith(query) ||
        bird.sciName.toLowerCase().includes(query),
    )
    .slice(0, 8)
    .map((bird) => ({ id: bird.id, name: bird.name, sciName: bird.sciName }));
  res.json({ results });
});

// --- 开局 ---
app.post(
  '/api/game/start',
  asyncRoute(async (req, res) => {
    const difficulty = parseDifficulty(req.body?.difficulty);
    if (!difficulty) return res.status(400).json({ error: 'invalid_difficulty' });
    if (!validGuestId(req.body?.guestId)) {
      return res.status(400).json({ error: 'invalid_guest_id' });
    }
    const conservation = req.body?.conservation ?? 'iucn';
    if (conservation !== 'iucn' && conservation !== 'china') {
      return res.status(400).json({ error: 'invalid_conservation' });
    }
    res.json(await startGame(difficulty, req.body.guestId, conservation));
  }),
);

const GUESS_ERROR_STATUS: Record<string, number> = {
  game_not_found: 404,
  forbidden: 403,
  bird_not_found: 400,
  not_in_pool: 400,
  game_over: 409,
  duplicate_guess: 409,
};

// --- 提交猜测 ---
app.post(
  '/api/game/:id/guess',
  asyncRoute(async (req, res) => {
    if (!validGuestId(req.body?.guestId)) {
      return res.status(400).json({ error: 'invalid_guest_id' });
    }
    const { birdId } = req.body ?? {};
    if (typeof birdId !== 'number' || !Number.isInteger(birdId)) {
      return res.status(400).json({ error: 'invalid_bird_id' });
    }
    const outcome = await submitGuess(
      req.params.id,
      req.body.guestId,
      birdId,
      authIdentity(req) ?? undefined,
    );
    if (!outcome.ok) {
      return res.status(GUESS_ERROR_STATUS[outcome.error]).json({ error: outcome.error });
    }
    res.json(outcome.game);
  }),
);

// --- 看答案（对局结束并揭晓，记为负场）---
app.post(
  '/api/game/:id/reveal',
  asyncRoute(async (req, res) => {
    if (!validGuestId(req.body?.guestId)) {
      return res.status(400).json({ error: 'invalid_guest_id' });
    }
    const outcome = await revealAnswer(
      req.params.id,
      req.body.guestId,
      authIdentity(req) ?? undefined,
    );
    if (!outcome.ok) {
      return res.status(GUESS_ERROR_STATUS[outcome.error]).json({ error: outcome.error });
    }
    res.json(outcome.game);
  }),
);

// --- 个人战绩：登录用户优先按账号查 ---
app.get(
  '/api/stats',
  asyncRoute(async (req, res) => {
    const identity = authIdentity(req);
    const guestId = String(req.query.guestId ?? '');
    if (!identity && !GUEST_ID_RE.test(guestId)) {
      return res.status(400).json({ error: 'invalid_guest_id' });
    }
    res.json(await db.getStats(identity ?? guestId));
  }),
);

// 本地生产运行仍从 client/dist 提供前端；Vercel 使用根 public/ 的 CDN。
const here = dirname(fileURLToPath(import.meta.url));
for (const candidate of [join(here, '..', '..', 'client', 'dist'), join(here, '..', 'client', 'dist')]) {
  if (!existsSync(join(candidate, 'index.html'))) continue;
  app.use(express.static(candidate));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(candidate, 'index.html')));
  break;
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[birdle] HTTP 请求失败', error);
  res.status(500).json({ error: 'server_unavailable' });
});

/** 创建 Express + Socket.IO 共用的原生 HTTP Server，供本地和 Vercel 共用。 */
export function createBirdleServer() {
  const httpServer = createServer(app);
  const io = new IoServer(httpServer, {
    cors: { origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' },
  });
  const redis = getRedis();
  if (redis) {
    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();
    pubClient.on('error', (error) => console.error('[birdle] Socket.IO Redis 发布失败', error));
    subClient.on('error', (error) => console.error('[birdle] Socket.IO Redis 订阅失败', error));
    io.adapter(createAdapter(pubClient, subClient));
  }
  attachGateway(io);
  return httpServer;
}

const httpServer = createBirdleServer();

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT ?? 3001);
  httpServer.listen(port, () => {
    console.log(`birdle server listening on http://localhost:${port}`);
  });
}

export default httpServer;
