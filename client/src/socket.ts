import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** Socket.IO 单例：Vercel 多实例不保证 polling 粘性，直接使用单条 WebSocket 连接。 */
export function getSocket(): Socket {
  if (!socket) {
    const url =
      (import.meta.env.VITE_SERVER_URL as string | undefined) ?? window.location.origin;
    socket = io(url, { transports: ['websocket'] });
  }
  return socket;
}
