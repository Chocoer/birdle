import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** Socket.IO 单例：开发时通过 VITE_SERVER_URL 直连后端，否则走同源 */
export function getSocket(): Socket {
  if (!socket) {
    const url =
      (import.meta.env.VITE_SERVER_URL as string | undefined) ?? window.location.origin;
    socket = io(url);
  }
  return socket;
}
