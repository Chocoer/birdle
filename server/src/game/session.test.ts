import { afterAll, describe, expect, it } from 'vitest';

process.env.DB_PATH = ':memory:';
delete process.env.DATABASE_URL;
delete process.env.REDIS_URL;

const guestId = 'guest-session-0001';
const session = await import('./session.js');
const { db } = await import('../db/index.js');

afterAll(() => db.close());

describe('单机 Session', () => {
  it('开局、身份校验、揭晓和战绩记账保持一致', async () => {
    const game = await session.startGame('easy', guestId);
    expect(game.status).toBe('playing');
    expect(game.answer).toBeUndefined();

    const forbidden = await session.revealAnswer(game.gameId, 'guest-session-9999');
    expect(forbidden).toEqual({ ok: false, error: 'forbidden' });

    const revealed = await session.revealAnswer(game.gameId, guestId);
    expect(revealed.ok && revealed.game.status).toBe('revealed');
    expect(revealed.ok && revealed.game.answer?.id).toBeTypeOf('number');
    expect(await session.revealAnswer(game.gameId, guestId)).toEqual({
      ok: false,
      error: 'game_over',
    });
    expect(await db.getStats(guestId)).toMatchObject({ played: 1, wins: 0 });
  });
});
