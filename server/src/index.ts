import express from 'express';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server as IoServer } from 'socket.io';
import { getStats } from './db.js';
import { poolOf, revealAnswer, startGame, submitGuess } from './game/session.js';
import { attachGateway } from './mp/gateway.js';
import type { Difficulty } from './types.js';

const app = express();
app.use(express.json());

const GUEST_ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

function parseDifficulty(v: unknown): Difficulty | undefined {
  return DIFFICULTIES.includes(v as Difficulty) ? (v as Difficulty) : undefined;
}

function validGuestId(v: unknown): v is string {
  return typeof v === 'string' && GUEST_ID_RE.test(v);
}

// --- 鸟类搜索（仅返回名称，用于自动补全；可按难度池限定范围）---
app.get('/api/birds/search', (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase();
  if (!q) return res.json({ results: [] });
  const difficulty = req.query.difficulty === undefined ? undefined : parseDifficulty(req.query.difficulty);
  if (req.query.difficulty !== undefined && !difficulty) {
    return res.status(400).json({ error: 'invalid_difficulty' });
  }
  const pool = difficulty ? poolOf(difficulty) : undefined;
  const results = (pool ?? poolOf('hard'))
    .filter(
      (b) =>
        b.name.includes(q) ||
        b.pinyin.startsWith(q) ||
        b.abbr.startsWith(q) ||
        b.sciName.toLowerCase().includes(q),
    )
    .slice(0, 8)
    .map((b) => ({ id: b.id, name: b.name, sciName: b.sciName }));
  res.json({ results });
});

// --- 开局 ---
app.post('/api/game/start', (req, res) => {
  const difficulty = parseDifficulty(req.body?.difficulty);
  if (!difficulty) return res.status(400).json({ error: 'invalid_difficulty' });
  if (!validGuestId(req.body?.guestId)) return res.status(400).json({ error: 'invalid_guest_id' });
  const rawConservation = req.body?.conservation;
  const conservation = rawConservation === undefined ? 'iucn' : rawConservation;
  if (conservation !== 'iucn' && conservation !== 'china') {
    return res.status(400).json({ error: 'invalid_conservation' });
  }
  res.json(startGame(difficulty, req.body.guestId, conservation));
});

const GUESS_ERROR_STATUS: Record<string, number> = {
  game_not_found: 404,
  forbidden: 403,
  bird_not_found: 400,
  not_in_pool: 400,
  game_over: 409,
  duplicate_guess: 409,
};

// --- 提交猜测 ---
app.post('/api/game/:id/guess', (req, res) => {
  if (!validGuestId(req.body?.guestId)) return res.status(400).json({ error: 'invalid_guest_id' });
  const { birdId } = req.body ?? {};
  if (typeof birdId !== 'number' || !Number.isInteger(birdId)) {
    return res.status(400).json({ error: 'invalid_bird_id' });
  }
  const outcome = submitGuess(req.params.id, req.body.guestId, birdId);
  if (!outcome.ok) return res.status(GUESS_ERROR_STATUS[outcome.error]).json({ error: outcome.error });
  res.json(outcome.game);
});

// --- 看答案（对局结束并揭晓，记为负场）---
app.post('/api/game/:id/reveal', (req, res) => {
  if (!validGuestId(req.body?.guestId)) return res.status(400).json({ error: 'invalid_guest_id' });
  const outcome = revealAnswer(req.params.id, req.body.guestId);
  if (!outcome.ok) return res.status(GUESS_ERROR_STATUS[outcome.error]).json({ error: outcome.error });
  res.json(outcome.game);
});

// --- 个人战绩 ---
app.get('/api/stats', (req, res) => {
  const guestId = String(req.query.guestId ?? '');
  if (!GUEST_ID_RE.test(guestId)) return res.status(400).json({ error: 'invalid_guest_id' });
  res.json(getStats(guestId));
});

// --- 生产模式：托管前端构建产物 ---
const here = dirname(fileURLToPath(import.meta.url));
for (const candidate of [join(here, '..', '..', 'client', 'dist'), join(here, '..', 'client', 'dist')]) {
  if (existsSync(join(candidate, 'index.html'))) {
    app.use(express.static(candidate));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(candidate, 'index.html')));
    break;
  }
}

const port = Number(process.env.PORT ?? 3001);
const httpServer = createServer(app);

// 联机对战：Socket.IO 与单机 HTTP API 共用同一端口
const io = new IoServer(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' },
});
attachGateway(io);

httpServer.listen(port, () => {
  console.log(`birdle server listening on http://localhost:${port}`);
});
