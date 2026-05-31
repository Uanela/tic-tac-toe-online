import playerService from "../../../modules/player/player.service";
import gameService from "../game.service";

export type Mark = "X" | "O";
export type Cell = Mark | null;
export type Board = Cell[];

export interface Player {
  socketId: string;
  userId: string;
  playerId: string;
  nickname: string;
  mark: Mark;
}

export interface GameRoom {
  roomId: string;
  gameId: string;
  players: [Player, Player];
  board: Board;
  currentTurn: Mark;
  status: "playing" | "finished";
}

const WIN_LINES = [
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

  emptyBoard(): Board {
    return Array(9).fill(null);
  }

  checkWinner(board: Board): Mark | "draw" | null {
    for (const [a, b, c] of WIN_LINES) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a] as Mark;
      }
    }
    if (board.every((cell) => cell !== null)) return "draw";
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

  deleteRoom(roomId: string) {
    this.rooms.delete(roomId);
  }

  findRoomBySocket(socketId: string): GameRoom | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.socketId === socketId)) return room;
    }
  }

  opponent(room: GameRoom, socketId: string): Player {
    return room.players.find((p) => p.socketId !== socketId)!;
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

    if (result === "Draw") {
      await Promise.all([
        winnerPlayerId && playerService.recordResult(winnerPlayerId, "draw"),
        loserPlayerId && playerService.recordResult(loserPlayerId, "draw"),
      ]);
    } else if (winnerPlayerId && loserPlayerId) {
      await Promise.all([
        playerService.recordResult(winnerPlayerId, "win"),
        playerService.recordResult(loserPlayerId, "loss"),
      ]);
    }
  }
}

const ticTacToeService = new TicTacToeService();

export default ticTacToeService;
