import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './worker.mjs';

test('代理静态资源、API 和 WebSocket，并只缓存静态资源', async (context) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (request, init) => {
    calls.push({ request, init });
    return new Response('ok');
  };
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  const assetResponse = await worker.fetch(
    new Request('https://edge.example/assets/app.js?v=1'),
  );
  await worker.fetch(new Request('https://edge.example/api/auth/me'));
  await worker.fetch(
    new Request('https://edge.example/socket.io/?EIO=4&transport=websocket', {
      headers: { Upgrade: 'websocket' },
    }),
  );

  assert.equal(calls[0].request.url, 'https://birdle-beijing.vercel.app/assets/app.js?v=1');
  assert.deepEqual(calls[0].init, {
    cf: { cacheEverything: true, cacheTtl: 31_536_000 },
  });
  assert.equal(assetResponse.headers.get('x-birdle-edge'), 'cloudflare-experimental');
  assert.equal(calls[1].init, undefined);
  assert.equal(calls[2].request.headers.get('Upgrade'), 'websocket');
  assert.equal(calls[2].init, undefined);
});
