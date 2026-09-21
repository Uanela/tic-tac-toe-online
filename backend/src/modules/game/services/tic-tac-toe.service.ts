import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "arkos/error-handler";
import playerService, { GameOutcome } from "../../../modules/player/player.service";
import championshipService from "../../../modules/championship/championship.service";
import rankAlertService from "../../../modules/notification/rank-alert.service";
import gameService from "../game.service";

export type Mark = "X" | "O";
export type Cell = Mark | null;
export type Board = Cell[];
export type MarkOrder = Record<Mark, number[]>;

export interface SocketPlayer {
  socketId?: string;
  userId: string;
  playerId: string;
  nickname: string;
  mark: Mark;
  xp: number;
  isBot: boolean;
}

export interface GameState {
  roomId: string;
  id: string;
  board: Board;
  currentTurn: Mark;
  players: Pick<SocketPlayer, "nickname" | "userId" | "mark">[];
  status: "playing" | "finished" | "starting";
  lastUpdate: Date;
  lastMove: { index: number; mark: Mark } | null;
  result: Mark | "draw" | null;
  doomed: Record<Mark, number | null>;
  winningLine: number[] | null;
  /** Measured here, not by the client, so the two clocks cannot drift apart. */
  timeLeftMs: number;
}

export interface GameRoom {
  id: string;
  roomId: string;
  gameId: string;
  players: [SocketPlayer, SocketPlayer];
  board: Board;
  placed: MarkOrder;
  currentTurn: Mark;
  status: "playing" | "finished" | "starting";
  result: Mark | "draw" | null;
  lastMove: { index: number; mark: Mark } | null;
  lastUpdate: Date;
  startedAt: Date;
}

export interface Invite {
  id: string;
  fromUserId: string;
  fromPlayerId: string;
  fromSocketId: string;
  fromNickname: string;
  toUserId: string;
  toPlayerId: string;
  toSocketId: string;
  toNickname: string;
  expiresAt: number;
  timer: NodeJS.Timeout;
}

export const MAX_MARKS = 3;

export const GAME_TIME_LIMIT_MS = 120_000;

/**
 * The client plays its match-found intro over a board that is already live, so
 * without this grace period the player on move pays for that animation out of
 * their own turn clock.
 */
export const START_DELAY_MS = 5_000;

export const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

class TicTacToeService {
  private rooms = new Map<string, GameRoom>();
  private waiting: {
    socketId: string;
    userId: string;
    playerId: string;
    nickname: string;
  } | null = null;
  private invites = new Map<string, Invite>();
  private waitingTimer: NodeJS.Timeout | null = null;
  private botMatchTimer: NodeJS.Timeout | null = null;

  getInvite(id: string) {
    return this.invites.get(id);
  }
  setInvite(id: string, invite: Invite) {
    this.invites.set(id, invite);
  }
  deleteInvite(id: string) {
    this.invites.delete(id);
  }

  /** Only the sender's socket: a challenge outlives the recipient's tab, which is what
   *  lets one reopened from a push still be answered. */
  findSentInviteBySocket(socketId: string) {
    for (const inv of this.invites.values()) {
      if (inv.fromSocketId === socketId) return inv;
    }
    return null;
  }

  setWaitingTimer(t: NodeJS.Timeout | null) {
    if (this.waitingTimer) clearTimeout(this.waitingTimer);
    this.waitingTimer = t;
  }

  setBotMatchTimer(t: NodeJS.Timeout | null) {
    if (this.botMatchTimer) clearTimeout(this.botMatchTimer);
    this.botMatchTimer = t;
  }

  clearWaitingTimers() {
    if (this.waitingTimer) clearTimeout(this.waitingTimer);
    if (this.botMatchTimer) clearTimeout(this.botMatchTimer);
    this.waitingTimer = null;
    this.botMatchTimer = null;
  }

  emptyBoard(): Board {
    return Array(9).fill(null);
  }

  // A full board is unreachable under the mark cap, so a draw can only come from the
  // controller's game clock — nothing here has to look for one.
  checkWinner(board: Board): Mark | null {
    for (const [a, b, c] of WIN_LINES) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a] as Mark;
      }
    }
    return null;
  }

  getWaiting() {
    return this.waiting;
  }

  setWaiting(
    player: {
      socketId: string;
      userId: string;
      playerId: string;
      nickname: string;
    } | null
  ) {
    this.waiting = player;
  }

  getRoom(roomId: string) {
    return this.rooms.get(roomId);
  }

  setRoom(roomId: string, room: GameRoom) {
    this.rooms.set(roomId, room);
  }

  updateRoom(roomId: string, room?: Partial<GameRoom>) {
    this.rooms.set(roomId, {
      ...this.getRoom(roomId)!,
      ...room,
      lastUpdate: new Date(),
    });
  }

  deleteRoom(roomId: string) {
    this.rooms.delete(roomId);
  }

  findRoomBySocket(socketId: string): GameRoom | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.socketId === socketId)) return room;
    }
  }

  opponent(room: GameRoom, playerId: string): SocketPlayer {
    return room.players.find((p) => p.playerId !== playerId)!;
  }

  seatedBotUserIds(): string[] {
    const ids: string[] = [];
    for (const room of this.rooms.values()) {
      for (const player of room.players) {
        if (player.isBot) ids.push(player.userId);
      }
    }
    return ids;
  }

  async resolvePlayer(userId: string) {
    return playerService.findByUserId(userId);
  }

  async createGame(playerOneId: string, playerTwoId: string) {
    return gameService.createGame(playerOneId, playerTwoId);
  }

  async finishGame(
    gameId: string,
    result: "PlayerOneWin" | "PlayerTwoWin" | "Draw",
    winnerPlayerId: string | null,
    loserPlayerId: string | null
  ) {
    await gameService.finishGame(gameId, result);

    const outcomes: { playerId: string; result: GameOutcome }[] = [];

    if (result === "Draw") {
      if (winnerPlayerId) outcomes.push({ playerId: winnerPlayerId, result: "draw" });
      if (loserPlayerId) outcomes.push({ playerId: loserPlayerId, result: "draw" });
    } else if (winnerPlayerId && loserPlayerId) {
      outcomes.push({ playerId: winnerPlayerId, result: "win" });
      outcomes.push({ playerId: loserPlayerId, result: "loss" });
    }

    await Promise.all([
      ...outcomes.map(({ playerId, result }) =>
        playerService.recordResult(playerId, result)
      ),
      championshipService.recordGame(outcomes),
    ]);

    rankAlertService
      .check(outcomes.map(({ playerId }) => playerId))
      .catch((error) => console.error("[rank-alert] post-match check failed", error));
  }

  /**
   * The cell that leaves the board when `mark` places again, or null while it is under the
   * cap. Oldest goes by default, but a mark that is the missing third of a line the opponent
   * already holds the other two of is skipped: evicting it ignores where its owner placed and
   * would hand over a win they had no way to avoid. If every mark blocks like that the oldest
   * goes anyway, which is the rule the client's dim has to agree with.
   */
  nextVictim(board: Board, placed: number[], mark: Mark): number | null {
    if (placed.length < MAX_MARKS) return null;

    for (const index of placed) if (!this.giftsWin(board, index, mark)) return index;
    return placed[0];
  }

  private giftsWin(board: Board, index: number, mark: Mark): boolean {
    const opponent = mark === "X" ? "O" : "X";

    for (const line of WIN_LINES) {
      if (!line.includes(index)) continue;
      if (line.every((cell) => cell === index || board[cell] === opponent))
        return true;
    }

    return false;
  }

  getRoomGameState(roomId: string): GameState {
    const room = this.getRoom(roomId);
    if (!room) throw new NotFoundError();

    return {
      roomId,
      id: roomId,
      board: room.board,
      currentTurn: room.currentTurn,
      players: room.players.map(({ nickname, xp, userId, mark, playerId }) => ({
        nickname,
        userId,
        mark,
        xp,
        id: playerId,
      })),
      status: room.status,
      lastUpdate: room.lastUpdate || new Date(),
      lastMove: room.lastMove || null,
      result: room.result,
      doomed: {
        X: this.nextVictim(room.board, room.placed.X, "X"),
        O: this.nextVictim(room.board, room.placed.O, "O"),
      },
      winningLine: this.winningLine(room),
      // `startedAt` is future-dated during the intro, so the elapsed half is floored
      // at zero and the clock reads as full rather than over-full.
      timeLeftMs:
        GAME_TIME_LIMIT_MS - Math.max(0, Date.now() - room.startedAt.getTime()),
    };
  }

  private winningLine(room: GameRoom): number[] | null {
    if (!room.result || room.result === "draw") return null;

    return (
      WIN_LINES.find((line) =>
        line.every((cell) => room.board[cell] === room.result)
      ) ?? null
    );
  }

  makeMove(roomId: string, index: number | null, player: SocketPlayer) {
    const room = ticTacToeService.getRoom(roomId);

    if (!room) throw new NotFoundError("Room not found");
    if (room.status === "finished")
      throw new BadRequestError("Game is already over.");

    if (player.mark !== room.currentTurn)
      throw new ForbiddenError("It's not your turn");

    if (typeof index !== "number" || index < 0 || index > 8)
      throw new BadRequestError("Invalid cell index.");
    if (room.board[index] !== null)
      throw new BadRequestError("Invalid cell index.");

    // Resolved before their own mark lands, so the cell that leaves is the one `doomed`
    // was pointing at a moment earlier.
    const victim = this.nextVictim(room.board, room.placed[player.mark], player.mark);

    room.board[index] = player.mark;
    room.placed[player.mark].push(index);

    if (victim !== null) {
      const order = room.placed[player.mark];
      order.splice(order.indexOf(victim), 1);
      room.board[victim] = null;
    }

    room.currentTurn = player.mark === "X" ? "O" : "X";

    ticTacToeService.updateRoom(room.roomId, {
      ...room,
      lastMove: { index, mark: player.mark },
    });
    return this.getRoomGameState(roomId);
  }

  cancelWaitingQueueBySocketId(socketId: string) {
    const waiting = ticTacToeService.getWaiting();
    if (waiting?.socketId === socketId) {
      ticTacToeService.clearWaitingTimers();
      ticTacToeService.setWaiting(null);
    }
  }

  cancelInviteByScoket(socketId: string) {
    const invite = ticTacToeService.findSentInviteBySocket(socketId);
    if (!invite) return;

    clearTimeout(invite.timer);
    ticTacToeService.deleteInvite(invite.id);

    return {
      pendingInvite: { id: invite.id, otherSocketId: invite.toSocketId },
    };
  }
}

const ticTacToeService = new TicTacToeService();

export default ticTacToeService;
