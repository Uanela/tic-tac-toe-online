import type { Server } from "socket.io";

const GAME_NAMESPACE = "/tic-tac-toe";

let io: Server | null = null;

export function setIo(server: Server) {
  io = server;
}

export function pingFeed(userId: string) {
  io?.of(GAME_NAMESPACE).to(`arkos::user:${userId}`).emit("notification");
}
