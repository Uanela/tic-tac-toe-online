import { ArkosGatewayController } from "arkos/websockets";
import { ArkosSocket } from "arkos/websockets";
import ticTacToeService, {
  GameRoom,
  Player,
} from "../services/tic-tac-toe.service";

class TicTacToeController extends ArkosGatewayController {
  async joinGame(
    socket: ArkosSocket,
    data: { nickname?: string },
    ack?: (res: any) => void,
    gatewayRef?: any
  ) {
    const userId = socket.user!.id;
    const player = await ticTacToeService.resolvePlayer(userId);

    if (!player)
      return ack?.({
        success: false,
        error: "Player profile not found. Create one first at /players.",
      });

    const nickname = player.nickname;
    const waiting = ticTacToeService.getWaiting();

    if (waiting && waiting.socketId !== socket.id) {
      const roomId = `room_${Date.now()}`;

      const playerX: Player = {
        socketId: waiting.socketId,
        userId: waiting.userId,
        playerId: waiting.playerId,
        nickname: waiting.nickname,
        mark: "X",
      };

      const playerO: Player = {
        socketId: socket.id,
        userId,
        playerId: player.id,
        nickname,
        mark: "O",
      };

      const game = await ticTacToeService.createGame(
        playerX.playerId,
        playerO.playerId
      );

      const room: GameRoom = {
        roomId,
        gameId: game.id,
        players: [playerX, playerO],
        board: ticTacToeService.emptyBoard(),
        currentTurn: "X",
        status: "playing",
      };

      ticTacToeService.setRoom(roomId, room);
      ticTacToeService.setWaiting(null);

      socket.join(roomId);
      await gatewayRef.socket(playerX.socketId).join(roomId);

      const base = { roomId, board: room.board, currentTurn: room.currentTurn };

      gatewayRef.socket(playerX.socketId).emit("game_start", {
        ...base,
        yourMark: "X",
        opponentNickname: playerO.nickname,
      });

      gatewayRef.socket(playerO.socketId).emit("game_start", {
        ...base,
        yourMark: "O",
        opponentNickname: playerX.nickname,
      });

      return ack?.({
        success: true,
        data: { ...base, yourMark: "O", opponentNickname: playerX.nickname },
      });
    }

    ticTacToeService.setWaiting({
      socketId: socket.id,
      userId,
      playerId: player.id,
      nickname,
    });
    ack?.({ success: true, data: { waiting: true } });
  }

  async makeMove(
    socket: ArkosSocket,
    data: { roomId: string; index: number },
    ack?: (res: any) => void,
    gatewayRef?: any
  ) {
    const { roomId, index } = data ?? {};
    const room = ticTacToeService.getRoom(roomId);

    if (!room) return ack?.({ success: false, error: "Room not found." });
    if (room.status === "finished")
      return ack?.({ success: false, error: "Game is already over." });

    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player)
      return ack?.({ success: false, error: "You are not in this room." });
    if (player.mark !== room.currentTurn)
      return ack?.({ success: false, error: "It's not your turn." });
    if (typeof index !== "number" || index < 0 || index > 8)
      return ack?.({ success: false, error: "Invalid cell index." });
    if (room.board[index] !== null)
      return ack?.({ success: false, error: "Cell already taken." });

    room.board[index] = player.mark;
    room.currentTurn = player.mark === "X" ? "O" : "X";

    gatewayRef.room(roomId).emit("move_made", {
      board: room.board,
      index,
      mark: player.mark,
      currentTurn: room.currentTurn,
    });

    ack?.({ success: true });

    const result = ticTacToeService.checkWinner(room.board);
    if (!result) return;

    room.status = "finished";

    const winnerPlayer =
      result !== "draw"
        ? room.players.find((p) => p.mark === result)
        : undefined;
    const loserPlayer = winnerPlayer
      ? ticTacToeService.opponent(room, winnerPlayer.socketId)
      : undefined;

    const gameResult =
      result === "draw"
        ? "Draw"
        : room.players[0].mark === result
          ? "PlayerOneWin"
          : "PlayerTwoWin";

    await ticTacToeService.finishGame(
      room.gameId,
      gameResult,
      winnerPlayer?.playerId ?? null,
      loserPlayer?.playerId ?? null
    );

    gatewayRef.room(roomId).emit("game_over", {
      board: room.board,
      result,
      winnerNickname: winnerPlayer?.nickname ?? null,
    });

    ticTacToeService.deleteRoom(roomId);
  }

  async onDisconnect(socket: ArkosSocket, gatewayRef?: any) {
    const waiting = ticTacToeService.getWaiting();
    if (waiting?.socketId === socket.id) {
      ticTacToeService.setWaiting(null);
      return;
    }

    const room = ticTacToeService.findRoomBySocket(socket.id);
    if (!room || room.status === "finished") return;

    room.status = "finished";

    const opp = ticTacToeService.opponent(room, socket.id);
    const leavingPlayer = room.players.find((p) => p.socketId === socket.id)!;

    const gameResult =
      room.players[0].socketId === opp.socketId
        ? "PlayerOneWin"
        : "PlayerTwoWin";

    await ticTacToeService.finishGame(
      room.gameId,
      gameResult,
      opp.playerId,
      leavingPlayer.playerId
    );

    gatewayRef.socket(opp.socketId).emit("opponent_left", {
      message: "Your opponent disconnected. You win by default!",
    });

    ticTacToeService.deleteRoom(room.roomId);
  }
}

const ticTacToeController = new TicTacToeController();

export default ticTacToeController;
