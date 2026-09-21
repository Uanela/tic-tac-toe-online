import type { Server } from "socket.io";

/** The namespace tabs connect to, so the only one whose `arkos::user:{id}` room is theirs. */
const GAME_NAMESPACE = "/tic-tac-toe";

/** Registered by server.ts: the crons boot before the io server exists. */
let io: Server | null = null;

export function setIo(server: Server) {
  io = server;
}

/** Tells any open tab that its feed grew. Nothing listening is not a failure. */
export function pingFeed(userId: string) {
  io?.of(GAME_NAMESPACE).to(`arkos::user:${userId}`).emit("notification");
}
