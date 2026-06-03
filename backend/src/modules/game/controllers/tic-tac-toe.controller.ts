import { ArkosGatewayController } from "arkos/websockets";
import { ArkosSocket } from "arkos/websockets";
import ticTacToeService, {
  GameRoom,
  Invite,
  Player,
} from "../services/tic-tac-toe.service";

const WAITING_TIMEOUT_MS = 30_000; // 60s in queue
const INVITE_TIMEOUT_MS = 30_000; // 30s to accept

class TicTacToeController extends ArkosGatewayController {
  // ─── helpers ────────────────────────────────────────────────────────────────

  /** Returns the "room_*" room the user is currently in, if any. */
  private activeRoomId(socket: ArkosSocket, userId: string): string | null {
    const rooms = socket.user(userId).rooms();
    return rooms.find((r) => r.startsWith("room_")) ?? null;
  }

  private async startGame(
    socket: ArkosSocket,
    playerX: Player,
    playerO: Player,
    gameId: string,
    roomId: string
  ): Promise<GameRoom> {
    const room: GameRoom = {
      roomId,
      gameId,
      players: [playerX, playerO],
      board: ticTacToeService.emptyBoard(),
      currentTurn: "X",
      status: "playing",
    };

    ticTacToeService.setRoom(roomId, room);

    const base = { roomId, board: room.board, currentTurn: room.currentTurn };

    // Use user() instead of peer() — safe against reconnects
    await socket.user(playerX.userId).join(roomId);
    await socket.user(playerO.userId).join(roomId);

    socket.user(playerX.userId).emit("game_start", {
      ...base,
      yourMark: "X",
      opponentNickname: playerO.nickname,
    });

    socket.user(playerO.userId).emit("game_start", {
      ...base,
      yourMark: "O",
      opponentNickname: playerX.nickname,
    });

    return room;
  }

  // ─── join_game (matchmaking queue) ──────────────────────────────────────────

  joinGame = async (
    socket: ArkosSocket,
    _data: any,
    ack?: (res: any) => void
  ) => {
    const userId = socket.currentUser!.id;
    const player = await ticTacToeService.resolvePlayer(userId);

    if (!player)
      return ack?.({ success: false, error: "Player profile not found." });

    // Guard: already in a game room?
    const existing = this.activeRoomId(socket, userId);
    if (existing)
      return ack?.({
        success: false,
        error: "You are already in a game.",
        alreadyInGame: true,
      });

    const waiting = ticTacToeService.getWaiting();

    if (waiting && waiting.socketId !== socket.id) {
      // Cancel the waiting timeout for the other player
      ticTacToeService.setWaitingTimer(null);

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
        nickname: player.nickname,
        mark: "O",
      };

      const game = await ticTacToeService.createGame(
        playerX.playerId,
        playerO.playerId
      );

      const room = await this.startGame(
        socket,
        playerX,
        playerO,
        game.id,
        roomId
      );

      // Both sockets join the Socket.IO room
      socket.join(roomId);
      await socket.peer(playerX.socketId).join(roomId);

      ticTacToeService.setWaiting(null);

      // Return game_start payload directly to the joining player via ack
      return ack?.({
        success: true,
        data: {
          roomId,
          board: room.board,
          currentTurn: room.currentTurn,
          yourMark: "O",
          opponentNickname: playerX.nickname,
        },
      });
    }

    // No one waiting — put this player in the queue with a timeout
    ticTacToeService.setWaiting({
      socketId: socket.id,
      userId,
      playerId: player.id,
      nickname: player.nickname,
    });

    const timer = setTimeout(() => {
      const still = ticTacToeService.getWaiting();
      if (still?.socketId === socket.id) {
        ticTacToeService.setWaiting(null);
        socket.emit("waiting_timeout", {
          message: "No opponent found in time. Please try again.",
        });
      }
    }, WAITING_TIMEOUT_MS);

    ticTacToeService.setWaitingTimer(timer);

    ack?.({ success: true, data: { waiting: true } });
  };

  // ─── send_invite ─────────────────────────────────────────────────────────────

  sendInvite = async (
    socket: ArkosSocket,
    data: { targetUserId: string },
    ack?: (res: any) => void
  ) => {
    const userId = socket.currentUser!.id;

    if (!data?.targetUserId || data.targetUserId === userId)
      return ack?.({ success: false, error: "Invalid target user." });

    const player = await ticTacToeService.resolvePlayer(userId);
    if (!player)
      return ack?.({ success: false, error: "Player profile not found." });

    // Guard: sender already in a game?
    // if (this.activeRoomId(socket, userId))
    //   return ack?.({ success: false, error: "You are already in a game." });

    // Guard: target online?
    const targetOnline = await socket.user(data.targetUserId).isOnline();
    if (!targetOnline)
      return ack?.({ success: false, error: "That player is not online." });

    // Guard: target already in a game?
    // if (this.activeRoomId(socket, data.targetUserId))
    //   return ack?.({
    //     success: false,
    //     error: "That player is already in a game.",
    //   });

    const targetPlayer = await ticTacToeService.resolvePlayer(
      data.targetUserId
    );
    if (!targetPlayer)
      return ack?.({
        success: false,
        error: "Target player profile not found.",
      });

    // Grab one of the target's socket IDs
    const targetSockets = await socket.user(data.targetUserId).fetchSockets();
    if (!targetSockets.length)
      return ack?.({
        success: false,
        error: "Target player is not reachable.",
      });

    const targetSocketId = targetSockets[0].id;
    const inviteId = `inv_${Date.now()}_${userId}`;

    const timer = setTimeout(() => {
      const inv = ticTacToeService.getInvite(inviteId);
      if (!inv) return;
      ticTacToeService.deleteInvite(inviteId);

      // Notify sender
      socket.emit("invite_expired", {
        inviteId,
        message: `${targetPlayer.nickname} did not respond in time.`,
      });
      // Notify target
      socket.peer(targetSocketId).emit("invite_expired", {
        inviteId,
        message: `Invite from ${player.nickname} expired.`,
      });
    }, INVITE_TIMEOUT_MS);

    const invite: Invite = {
      id: inviteId,
      fromUserId: userId,
      fromPlayerId: player.id,
      fromSocketId: socket.id,
      fromNickname: player.nickname,
      toUserId: data.targetUserId,
      toPlayerId: targetPlayer.id,
      toSocketId: targetSocketId,
      toNickname: targetPlayer.nickname,
      expiresAt: Date.now() + INVITE_TIMEOUT_MS,
      timer,
    };

    ticTacToeService.setInvite(inviteId, invite);

    // Notify target
    socket.peer(targetSocketId).emit("invite_received", {
      inviteId,
      fromNickname: player.nickname,
      fromUserId: userId,
      expiresAt: invite.expiresAt,
    });

    ack?.({ success: true, data: { inviteId, expiresAt: invite.expiresAt } });
  };

  // ─── accept_invite ────────────────────────────────────────────────────────

  acceptInvite = async (
    socket: ArkosSocket,
    data: { inviteId: string },
    ack?: (res: any) => void
  ) => {
    const userId = socket.currentUser!.id;
    const invite = ticTacToeService.getInvite(data?.inviteId);

    if (!invite || invite.toUserId !== userId)
      return ack?.({
        success: false,
        error: "Invite not found or already expired.",
      });

    // Guard: either player already in a game?
    if (this.activeRoomId(socket, userId))
      return ack?.({ success: false, error: "You are already in a game." });
    if (this.activeRoomId(socket, invite.fromUserId))
      return ack?.({
        success: false,
        error: "The inviting player is already in another game.",
      });

    clearTimeout(invite.timer);
    ticTacToeService.deleteInvite(invite.id);

    const roomId = `room_${Date.now()}`;

    // Inviter = X, accepter = O  (consistent, clear)
    const playerX: Player = {
      socketId: invite.fromSocketId,
      userId: invite.fromUserId,
      playerId: invite.fromPlayerId,
      nickname: invite.fromNickname,
      mark: "X",
    };
    const playerO: Player = {
      socketId: socket.id,
      userId,
      playerId: invite.toPlayerId,
      nickname: invite.toNickname,
      mark: "O",
    };

    const game = await ticTacToeService.createGame(
      playerX.playerId,
      playerO.playerId
    );
    const room = await this.startGame(
      socket,
      playerX,
      playerO,
      game.id,
      roomId
    );

    socket.join(roomId);
    await socket.peer(playerX.socketId).join(roomId);

    // Return ack payload for the accepter (same shape as game_start)
    return ack?.({
      success: true,
      data: {
        roomId,
        board: room.board,
        currentTurn: room.currentTurn,
        yourMark: "O",
        opponentNickname: playerX.nickname,
      },
    });
  };

  // ─── decline_invite ───────────────────────────────────────────────────────

  declineInvite = async (
    socket: ArkosSocket,
    data: { inviteId: string },
    ack?: (res: any) => void
  ) => {
    const userId = socket.currentUser!.id;
    const invite = ticTacToeService.getInvite(data?.inviteId);

    if (!invite || invite.toUserId !== userId)
      return ack?.({ success: false, error: "Invite not found." });

    clearTimeout(invite.timer);
    ticTacToeService.deleteInvite(invite.id);

    // Notify sender
    try {
      socket.peer(invite.fromSocketId).emit("invite_declined", {
        inviteId: invite.id,
        byNickname: invite.toNickname,
        message: `${invite.toNickname} declined your invite.`,
      });
    } catch {
      // Sender may have disconnected — ignore
    }

    ack?.({ success: true });
  };

  // ─── make_move ────────────────────────────────────────────────────────────

  makeMove = async (
    socket: ArkosSocket,
    data: { roomId: string; index: number },
    ack?: (res: any) => void
  ) => {
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

    socket.nsp.to(roomId).emit("move_made", {
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

    // Emit to the entire room (both players see board + winner name)
    socket.to(roomId).emit("game_over", {
      board: room.board,
      result, // "X" | "O" | "draw"
      winnerNickname: winnerPlayer?.nickname ?? null,
    });

    // Also emit to the socket that made the final move
    socket.emit("game_over", {
      board: room.board,
      result,
      winnerNickname: winnerPlayer?.nickname ?? null,
    });

    socket.to(roomId).socketsLeave(roomId);
    socket.leave(roomId);

    ticTacToeService.deleteRoom(roomId);
  };

  // ─── onDisconnect ─────────────────────────────────────────────────────────

  async onDisconnect(socket: ArkosSocket) {
    const userId = socket.currentUser?.id;

    // Cancel waiting queue slot
    const waiting = ticTacToeService.getWaiting();
    if (waiting?.socketId === socket.id) {
      ticTacToeService.setWaitingTimer(null);
      ticTacToeService.setWaiting(null);
    }

    // Cancel any pending invites involving this socket
    const invite = ticTacToeService.findInviteBySocket(socket.id);
    if (invite) {
      clearTimeout(invite.timer);
      ticTacToeService.deleteInvite(invite.id);

      const otherSocketId =
        invite.fromSocketId === socket.id
          ? invite.toSocketId
          : invite.fromSocketId;

      try {
        socket.peer(otherSocketId).emit("invite_expired", {
          inviteId: invite.id,
          message: "The other player disconnected.",
        });
      } catch {
        /* ignore */
      }
    }

    // Handle active game disconnect
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

    try {
      socket.peer(opp.socketId).emit("opponent_left", {
        message: "Your opponent disconnected. You win by default!",
      });
    } catch {
      /* ignore */
    }

    ticTacToeService.deleteRoom(room.roomId);
  }
}

const ticTacToeController = new TicTacToeController();
export default ticTacToeController;
