import { ArkosGatewayController } from "arkos/websockets";
import { ArkosSocket } from "arkos/websockets";
import ticTacToeService, {
  GameRoom,
  GameState,
  Invite,
  SocketPlayer,
} from "../services/tic-tac-toe.service";
import playerService from "../../player/player.service";
import { NotFoundError } from "arkos/error-handler";
import { emailService } from "arkos/services";
import userService from "../../user/user.service";
import challengeEmail from "../utils/email-templates/challenge.email";

const WAITING_TIMEOUT_MS = 30_000; // 60s in queue
const INVITE_TIMEOUT_MS = 120_000; // 2min to accept
const ROUND_TIME = 10_000;

export let onlineSockets: { userId: string; socketId: string }[] = [];

class TicTacToeController extends ArkosGatewayController {
  // ─── helpers ────────────────────────────────────────────────────────────────

  /** Returns the "room_*" room the user is currently in, if any. */
  private activeRoomId(socket: ArkosSocket, userId: string): string | null {
    const rooms = socket.user(userId).rooms();
    return rooms.find((r) => r.startsWith("room_")) ?? null;
  }

  private emitGameState(socket: ArkosSocket, roomId: string) {
    try {
      const gameState = {
        ...(ticTacToeService.getRoomGameState(roomId) || {}),
        counter: 10,
      };

      socket.user(gameState.players[0].userId).emit("game_state", gameState);

      socket.user(gameState.players[1].userId).emit("game_state", gameState);

      return gameState;
    } catch {
      return null;
    }
  }

  private async startGame(
    socket: ArkosSocket,
    playerX: SocketPlayer,
    playerO: SocketPlayer,
    gameId: string,
    roomId: string
  ): Promise<GameState | null> {
    const lastUpdate = new Date();

    const room: GameRoom = {
      id: roomId,
      roomId,
      gameId,
      players: [playerX, playerO],
      board: ticTacToeService.emptyBoard(),
      currentTurn: ["X", "O"][
        Math.floor(Math.random() * 2)
      ] as GameRoom["currentTurn"],
      status: "playing",
      lastUpdate,
      lastMove: null,
      result: null,
    };

    ticTacToeService.setRoom(roomId, room);

    await socket.user(playerX.userId).join(roomId);
    await socket.user(playerO.userId).join(roomId);

    const gameState = this.emitGameState(socket, roomId);

    const interval = setInterval(() => {
      let currentState: GameState | null = null;
      try {
        currentState = ticTacToeService.getRoomGameState(roomId);
      } catch {
        // this.cleanupBySocket(socket, playerX.socketId);
        // this.cleanupBySocket(socket, playerO.socketId);
        return clearInterval(interval);
      }

      if (!currentState) {
        // this.cleanupBySocket(socket, playerX.socketId);
        // this.cleanupBySocket(socket, playerO.socketId);
        return clearInterval(interval);
      }
      const diff = new Date().getTime() - currentState?.lastUpdate.getTime();

      if (currentState.status === "finished" || diff >= 30_000) {
        clearInterval(interval);
        if (diff >= 30_000) {
          this.cleanupBySocket(socket, playerX.socketId);
          this.cleanupBySocket(socket, playerO.socketId);
        }
        return;
      }

      if (diff >= ROUND_TIME) {
        ticTacToeService.updateRoom(roomId, {
          lastUpdate: new Date(),
          currentTurn: currentState?.currentTurn === "X" ? "O" : "X",
        });
        this.emitGameState(socket, roomId);
      }
    }, ROUND_TIME);

    return gameState;
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

    if (waiting && waiting.userId !== socket.currentUser?.id) {
      // Cancel the waiting timeout for the other player
      ticTacToeService.setWaitingTimer(null);

      const roomId = `room_${Date.now()}`;

      const [waitingFullData, playerFullData] = await Promise.all([
        playerService.findById(waiting.playerId),
        playerService.findById(player.id),
      ]);

      const playerX: SocketPlayer = {
        socketId: waiting.socketId,
        userId: waiting.userId,
        playerId: waiting.playerId,
        nickname: waiting.nickname,
        xp: waitingFullData!.xp,
        mark: "X",
      };
      const playerO: SocketPlayer = {
        socketId: socket.id,
        userId,
        playerId: player.id,
        nickname: player.nickname,
        xp: playerFullData!.xp,
        mark: "O",
      };

      const game = await ticTacToeService.createGame(
        playerX.playerId,
        playerO.playerId
      );

      const gameState = await this.startGame(
        socket,
        playerX,
        playerO,
        game.id,
        roomId
      );
      if (!gameState) return;

      // Both sockets join the Socket.IO room
      socket.join(roomId);
      await socket.peer(playerX.socketId).join(roomId);

      ticTacToeService.setWaiting(null);

      // Return game_start payload directly to the joining player via ack
      return ack?.({
        success: true,
        data: gameState,
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
    // const targetOnline = await socket.user(data.targetUserId).isOnline();
    // if (!targetOnline)
    //   ack?.({ success: false, error: "That player is not online." });

    const targetUser = await userService.findById(data.targetUserId);
    if (!targetUser)
      return ack?.({
        success: false,
        error: "Não foi possivel encontrar o jogador",
      });

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
    // if (!targetSockets.length)
    //   ack?.({
    //     success: false,
    //     error: "Target player is not reachable.",
    //   });

    const targetSocketId = targetSockets[0]?.id;
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
      socket.to(targetSocketId).emit("invite_expired", {
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
    socket.user(data.targetUserId).emit("invite_received", {
      inviteId,
      fromNickname: player.nickname,
      fromUserId: userId,
      expiresAt: invite.expiresAt,
    });

    const targetOnline = await socket.user(data.targetUserId).isOnline();
    if (!targetOnline)
      emailService
        .send({
          to: targetUser.email,
          subject: `🎮 ${player.nickname} te desafiou para uma partida em X e O`,
          html: challengeEmail(player, targetPlayer, inviteId),
        })
        .catch(console.error);

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
    const [fromPlayerFullData, toPlayerFullData] = await Promise.all([
      playerService.findById(invite.fromPlayerId),
      playerService.findById(invite.toPlayerId),
    ]);

    // Inviter = X, accepter = O  (consistent, clear)
    const playerX: SocketPlayer = {
      socketId: invite.fromSocketId,
      userId: invite.fromUserId,
      playerId: invite.fromPlayerId,
      nickname: invite.fromNickname,
      xp: fromPlayerFullData!.xp,
      mark: "X",
    };
    const playerO: SocketPlayer = {
      socketId: socket.id,
      userId,
      playerId: invite.toPlayerId,
      nickname: invite.toNickname,
      xp: toPlayerFullData!.xp,
      mark: "O",
    };

    const game = await ticTacToeService.createGame(
      playerX.playerId,
      playerO.playerId
    );
    const gameState = await this.startGame(
      socket,
      playerX,
      playerO,
      game.id,
      roomId
    );

    socket.join(roomId);
    await socket.peer(playerX.socketId).join(roomId);

    // Return ack payload for the accepter (same shape as game_start)
    ack?.({
      success: true,
      data: gameState,
    });

    this.emitGameState(socket, roomId);
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
      socket.to(invite.fromSocketId).emit("invite_declined", {
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

    if (!room) throw new NotFoundError("Room not found");

    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) throw new NotFoundError("Your are not in this room");

    try {
      ticTacToeService.makeMove(roomId, index, player);
    } catch (err: any) {
      return ack?.({ sucess: false, error: err.message });
    }

    this.emitGameState(socket, roomId);

    ack?.({ success: true });

    ticTacToeService.updateRoom(room.roomId);

    const result = ticTacToeService.checkWinner(room.board);
    if (!result) return;

    room.status = "finished";

    const winnerPlayer =
      result !== null ? room.players.find((p) => p.mark === result) : undefined;
    const loserPlayer = winnerPlayer
      ? ticTacToeService.opponent(room, winnerPlayer.socketId)
      : undefined;

    const gameResult =
      result === null || result === "draw"
        ? "Draw"
        : room.players[0].mark === result
          ? "PlayerOneWin"
          : "PlayerTwoWin";

    ticTacToeService.updateRoom(room.roomId, {
      result,
      status: "finished",
    });

    await ticTacToeService.finishGame(
      room.gameId,
      gameResult,
      winnerPlayer?.playerId ?? room.players[0].playerId,
      loserPlayer?.playerId ?? room.players[1].playerId
    );

    this.emitGameState(socket, roomId);

    socket.to(roomId).socketsLeave(roomId);
    socket.leave(roomId);

    ticTacToeService.deleteRoom(roomId);
  };

  onConnect = async (socket: ArkosSocket) => {
    if (!socket.currentUser?.id) return;
    if (!onlineSockets.find((s) => s.userId === socket.currentUser?.id))
      onlineSockets.push({
        userId: socket.currentUser?.id!,
        socketId: socket.id,
      });

    const room = this.activeRoomId(socket, socket.currentUser?.id);

    if (room) this.emitGameState(socket, room);
  };

  private async cleanupBySocket(socket: ArkosSocket, socketId: string) {
    onlineSockets = onlineSockets.filter(
      (s) => s.userId !== socket.currentUser?.id
    );
    ticTacToeService.cancelWaitingQueueBySocketId(socketId);
    const invite = ticTacToeService.cancelInviteByScoket(socketId);

    if (invite)
      socket.to(invite.pendingInvite.otherSocketId).emit("invite_expired", {
        inviteId: invite.pendingInvite.id,
        message: "The other player disconnected.",
      });

    const room = ticTacToeService.findRoomBySocket(socket.id);
    if (!room || room.status === "finished") return;

    room.status = "finished";
    ticTacToeService.updateRoom(room.id, { status: "finished" });

    const opp = ticTacToeService.opponent(room, socket.id);
    const leavingPlayer = room.players.find((p) => p.socketId === socket.id)!;

    const gameResult =
      room.players[0].socketId === opp.socketId
        ? "PlayerOneWin"
        : "PlayerTwoWin";

    socket.nsp.to(room.id).socketsLeave(room.id);

    await ticTacToeService.finishGame(
      room.gameId,
      gameResult,
      opp.playerId,
      leavingPlayer.playerId
    );

    try {
      socket.to(opp.socketId).emit("opponent_left", {
        message: "Your opponent disconnected. You win by default!",
      });
    } catch {
      /* ignore */
    }

    ticTacToeService.deleteRoom(room.roomId);
  }

  onDisconnect = async (socket: ArkosSocket) => {
    // await timers.setTimeout(10000);

    await this.cleanupBySocket(socket, socket.id);

    // Handle active game disconnect
  };
}

const ticTacToeController = new TicTacToeController();

export default ticTacToeController;
