const ORIGIN = 'https://birdle-beijing.vercel.app';

/** 将实验入口的 HTTP 与 WebSocket 请求代理到正式 Vercel 源站。 */
export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const upstream = new URL(incoming.pathname + incoming.search, ORIGIN);
    const websocket = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
    const dynamic = incoming.pathname.startsWith('/api/') || incoming.pathname.startsWith('/socket.io/');
    const cache =
      request.method === 'GET' && !websocket && !dynamic
        ? {
            cf: {
              cacheEverything: true,
              cacheTtl: incoming.pathname.startsWith('/assets/') ? 31_536_000 : 300,
            },
          }
        : undefined;

    const response = await fetch(new Request(upstream, request), cache);
    if (websocket) return response;

    const proxied = new Response(response.body, response);
    proxied.headers.set('x-birdle-edge', 'cloudflare-experimental');
    return proxied;
  },
};
