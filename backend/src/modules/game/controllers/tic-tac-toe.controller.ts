import { ArkosGatewayController } from "arkos/websockets";
import { ArkosSocket } from "arkos/websockets";
import ticTacToeService, {
  GameRoom,
  GameState,
  Invite,
  Mark,
  SocketPlayer,
} from "../services/tic-tac-toe.service";
import playerService from "../../player/player.service";
import playerBotService from "../../player/player-bot.service";
import { NotFoundError } from "arkos/error-handler";
import { emailService } from "arkos/services";
import userService from "../../user/user.service";
import challengeEmail from "../utils/email-templates/challenge.email";
import notificationPreferenceService from "../../notification-preference/notification-preference.service";
import botService from "../services/bot.service";

const WAITING_TIMEOUT_MS = 20_000;
const BOT_MATCH_TIMEOUT_MS = 10_000;
const BOT_MOVE_MIN_MS = 1_000;
const BOT_MOVE_MAX_MS = 5_000;
const BOT_INVITE_ACCEPT_MS = 1_500;
const INVITE_TIMEOUT_MS = 120_000; // 2min to accept
const ROUND_TIME = 10_000;
const GAME_TIME_LIMIT_MS = 120_000;

export let onlineSockets: { userId: string; socketId: string }[] = [];

class TicTacToeController extends ArkosGatewayController {
  // ─── helpers ────────────────────────────────────────────────────────────────

  /** Returns the "room_*" room the user is currently in, if any. */
  private async activeRoomId(socket: ArkosSocket, userId: string) {
    const rooms = await socket.user(userId).activeRooms();
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
    roomId: string,
  ): Promise<GameState | null> {
    const startedAt = new Date();

    const room: GameRoom = {
      id: roomId,
      roomId,
      gameId,
      players: [playerX, playerO],
      board: ticTacToeService.emptyBoard(),
      placed: { X: [], O: [] },
      currentTurn: ["X", "O"][
        Math.floor(Math.random() * 2)
      ] as GameRoom["currentTurn"],
      status: "playing",
      lastUpdate: startedAt,
      lastMove: null,
      result: null,
      startedAt,
    };

    ticTacToeService.setRoom(roomId, room);

    socket.user(playerX.userId).socketsJoin(roomId);
    socket.user(playerO.userId).socketsJoin(roomId);

    const gameState = this.emitGameState(socket, roomId);
    this.scheduleBotTurn(socket, room);

    const interval = setInterval(async () => {
      const live = ticTacToeService.getRoom(roomId);
      if (!live || live.status === "finished") return clearInterval(interval);

      if (Date.now() - live.startedAt.getTime() >= GAME_TIME_LIMIT_MS) {
        clearInterval(interval);
        await this.finishRoom(socket, live, "draw");
        return;
      }

      if (Date.now() - live.lastUpdate.getTime() < ROUND_TIME) return;

      ticTacToeService.updateRoom(roomId, {
        lastUpdate: new Date(),
        currentTurn: live.currentTurn === "X" ? "O" : "X",
      });
      this.emitGameState(socket, roomId);

      const next = ticTacToeService.getRoom(roomId);
      if (next) this.scheduleBotTurn(socket, next);
    }, ROUND_TIME);

    return gameState;
  }

  private async finishRoom(
    socket: ArkosSocket,
    room: GameRoom,
    result: Mark | "draw",
  ) {
    room.status = "finished";

    const winnerPlayer = room.players.find((p) => p.mark === result);
    const loserPlayer = winnerPlayer
      ? ticTacToeService.opponent(room, winnerPlayer.playerId)
      : undefined;

    const gameResult =
      result === "draw"
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
      loserPlayer?.playerId ?? room.players[1].playerId,
    );

    this.emitGameState(socket, room.roomId);

    socket.to(room.roomId).socketsLeave(room.roomId);
    socket.leave(room.roomId);

    ticTacToeService.deleteRoom(room.roomId);
  }

  private async applyMove(
    socket: ArkosSocket,
    room: GameRoom,
    player: SocketPlayer,
    index: number,
  ) {
    ticTacToeService.makeMove(room.roomId, index, player);

    this.emitGameState(socket, room.roomId);
    ticTacToeService.updateRoom(room.roomId);

    const result = ticTacToeService.checkWinner(room.board);
    if (!result) return this.scheduleBotTurn(socket, room);

    await this.finishRoom(socket, room, result);
  }

  private scheduleBotTurn(socket: ArkosSocket, room: GameRoom) {
    const current = room.players.find((p) => p.mark === room.currentTurn);
    if (!current?.isBot) return;

    const delay =
      BOT_MOVE_MIN_MS + Math.random() * (BOT_MOVE_MAX_MS - BOT_MOVE_MIN_MS);

    setTimeout(async () => {
      const live = ticTacToeService.getRoom(room.roomId);
      if (!live || live.status !== "playing") return;

      const bot = live.players.find((p) => p.mark === live.currentTurn);
      if (!bot?.isBot || bot.playerId !== current.playerId) return;

      const index = botService.chooseMove(live.board, bot.mark, live.placed);
      if (index < 0) return;

      try {
        await this.applyMove(socket, live, bot, index);
      } catch {
        // The room can be torn down during the delay; the bot's move is moot then.
      }
    }, delay);
  }

  private async beginGameFromInvite(
    socket: ArkosSocket,
    invite: Invite,
    toSocketId: string | undefined,
    toIsBot: boolean,
  ) {
    const roomId = `room_${Date.now()}`;

    const [fromPlayerFullData, toPlayerFullData] = await Promise.all([
      playerService.findById(invite.fromPlayerId),
      playerService.findById(invite.toPlayerId),
    ]);

    const playerX: SocketPlayer = {
      socketId: invite.fromSocketId,
      userId: invite.fromUserId,
      playerId: invite.fromPlayerId,
      nickname: invite.fromNickname,
      xp: fromPlayerFullData!.xp,
      mark: "X",
      isBot: false,
    };
    const playerO: SocketPlayer = {
      socketId: toSocketId,
      userId: invite.toUserId,
      playerId: invite.toPlayerId,
      nickname: invite.toNickname,
      xp: toPlayerFullData!.xp,
      mark: "O",
      isBot: toIsBot,
    };

    const game = await ticTacToeService.createGame(
      playerX.playerId,
      playerO.playerId,
    );
    const gameState = await this.startGame(
      socket,
      playerX,
      playerO,
      game.id,
      roomId,
    );

    socket.join(roomId);
    socket.to(invite.fromSocketId).socketsJoin(roomId);

    return gameState;
  }

  // ─── join_game (matchmaking queue) ──────────────────────────────────────────

  joinGame = async (
    socket: ArkosSocket,
    _data: any,
    ack?: (res: any) => void,
  ) => {
    const userId = socket.currentUser!.id;
    const player = await ticTacToeService.resolvePlayer(userId);

    if (!player)
      return ack?.({ success: false, error: "Player profile not found." });

    // Guard: already in a game room?
    const existing = await this.activeRoomId(socket, userId);
    if (existing)
      return ack?.({
        success: false,
        error: "You are already in a game.",
        alreadyInGame: true,
      });

    const waiting = ticTacToeService.getWaiting();

    if (waiting && waiting.userId !== socket.currentUser?.id) {
      // Cancel the waiting timeouts for the other player — a human took the slot.
      ticTacToeService.clearWaitingTimers();

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
        isBot: false,
      };
      const playerO: SocketPlayer = {
        socketId: socket.id,
        userId,
        playerId: player.id,
        nickname: player.nickname,
        xp: playerFullData!.xp,
        mark: "O",
        isBot: false,
      };

      const game = await ticTacToeService.createGame(
        playerX.playerId,
        playerO.playerId,
      );

      const gameState = await this.startGame(
        socket,
        playerX,
        playerO,
        game.id,
        roomId,
      );
      if (!gameState) return;

      // Both sockets join the Socket.IO room
      socket.join(roomId);
      if (playerX.socketId) socket.to(playerX.socketId).socketsJoin(roomId);

      ticTacToeService.setWaiting(null);

      // Return game_start payload directly to the joining player via ack
      return ack?.({
        success: true,
        data: gameState,
      });
    }

    // No one waiting — put this player in the queue with a timeout
    const waitingEntry = {
      socketId: socket.id,
      userId,
      playerId: player.id,
      nickname: player.nickname,
    };

    ticTacToeService.setWaiting(waitingEntry);

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

    const botTimer = setTimeout(
      () => this.matchWithBot(socket, waitingEntry),
      BOT_MATCH_TIMEOUT_MS,
    );

    ticTacToeService.setBotMatchTimer(botTimer);

    ack?.({ success: true, data: { waiting: true } });
  };

  private async matchWithBot(
    socket: ArkosSocket,
    waiting: {
      socketId: string;
      userId: string;
      playerId: string;
      nickname: string;
    },
  ) {
    const still = ticTacToeService.getWaiting();
    if (still?.socketId !== waiting.socketId) return;

    ticTacToeService.setWaiting(null);
    ticTacToeService.clearWaitingTimers();

    try {
      const bot = await playerBotService.findOrCreateBot();

      const human = await playerService.findById(waiting.playerId);
      if (!human) return;

      const roomId = `room_${Date.now()}`;
      const firstMark: Mark = Math.random() < 0.5 ? "X" : "O";

      const humanPlayer: SocketPlayer = {
        socketId: waiting.socketId,
        userId: waiting.userId,
        playerId: waiting.playerId,
        nickname: waiting.nickname,
        xp: human.xp,
        mark: firstMark,
        isBot: false,
      };
      const botPlayer: SocketPlayer = {
        userId: bot.userId,
        playerId: bot.id,
        nickname: bot.nickname,
        xp: bot.xp,
        mark: firstMark === "X" ? "O" : "X",
        isBot: true,
      };

      const [playerX, playerO] =
        humanPlayer.mark === "X"
          ? [humanPlayer, botPlayer]
          : [botPlayer, humanPlayer];

      const game = await ticTacToeService.createGame(
        playerX.playerId,
        playerO.playerId,
      );

      await this.startGame(socket, playerX, playerO, game.id, roomId);
    } catch {
      socket.emit("waiting_timeout", {
        message: "No opponent found in time. Please try again.",
      });
    }
  }

  // ─── send_invite ─────────────────────────────────────────────────────────────

  sendInvite = async (
    socket: ArkosSocket,
    data: { targetUserId: string },
    ack?: (res: any) => void,
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
      data.targetUserId,
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
    const targetIsBot = await playerBotService.isBotUser(data.targetUserId);
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

    const targetOnline =
      (await socket.user(data.targetUserId).activeRooms()).length > 0;
    if (
      !targetIsBot &&
      !targetOnline &&
      (await notificationPreferenceService.canNotify(
        data.targetUserId,
        "Challenge",
      ))
    )
      emailService
        .send({
          to: targetUser.email,
          subject: `🎮 ${player.nickname} te desafiou para uma partida em X e O`,
          html: challengeEmail(player, targetPlayer, inviteId),
        })
        .catch(console.error);

    ack?.({ success: true, data: { inviteId, expiresAt: invite.expiresAt } });

    if (targetIsBot)
      setTimeout(async () => {
        const live = ticTacToeService.getInvite(inviteId);
        if (!live) return;

        clearTimeout(live.timer);
        ticTacToeService.deleteInvite(inviteId);

        try {
          await this.beginGameFromInvite(socket, live, undefined, true);
        } catch {
          socket.emit("invite_expired", {
            inviteId,
            message: `${live.toNickname} did not respond in time.`,
          });
        }
      }, BOT_INVITE_ACCEPT_MS);
  };

  // ─── accept_invite ────────────────────────────────────────────────────────

  acceptInvite = async (
    socket: ArkosSocket,
    data: { inviteId: string },
    ack?: (res: any) => void,
  ) => {
    const userId = socket.currentUser!.id;
    const invite = ticTacToeService.getInvite(data?.inviteId);

    if (!invite || invite.toUserId !== userId)
      return ack?.({
        success: false,
        error: "Invite not found or already expired.",
      });

    // Guard: either player already in a game?
    if (await this.activeRoomId(socket, userId))
      return ack?.({ success: false, error: "You are already in a game." });
    if (await this.activeRoomId(socket, invite.fromUserId))
      return ack?.({
        success: false,
        error: "The inviting player is already in another game.",
      });

    clearTimeout(invite.timer);
    ticTacToeService.deleteInvite(invite.id);

    const gameState = await this.beginGameFromInvite(
      socket,
      invite,
      socket.id,
      await playerBotService.isBotUser(invite.toUserId),
    );

    ack?.({
      success: true,
      data: gameState,
    });
  };

  // ─── decline_invite ───────────────────────────────────────────────────────

  declineInvite = async (
    socket: ArkosSocket,
    data: { inviteId: string },
    ack?: (res: any) => void,
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
    ack?: (res: any) => void,
  ) => {
    const { roomId, index } = data ?? {};
    const room = ticTacToeService.getRoom(roomId);

    if (!room) throw new NotFoundError("Room not found");

    const player = room.players.find(
      (p) => p.userId === socket.currentUser?.id,
    );
    if (!player) throw new NotFoundError("Your are not in this room");

    try {
      await this.applyMove(socket, room, player, index);
    } catch (err: any) {
      return ack?.({ success: false, error: err.message });
    }

    ack?.({ success: true });
  };

  onConnect = async (socket: ArkosSocket) => {
    if (!socket.currentUser?.id) return;
    if (!onlineSockets.find((s) => s.userId === socket.currentUser?.id))
      onlineSockets.push({
        userId: socket.currentUser?.id!,
        socketId: socket.id,
      });

    const room = await this.activeRoomId(socket, socket.currentUser?.id);

    if (room) this.emitGameState(socket, room);
  };

  private async cleanupBySocket(socket: ArkosSocket, socketId: string) {
    onlineSockets = onlineSockets.filter(
      (s) => s.userId !== socket.currentUser?.id,
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

    const leavingPlayer = room.players.find((p) => p.socketId === socket.id)!;
    const opp = ticTacToeService.opponent(room, leavingPlayer.playerId);

    const gameResult =
      room.players[0].playerId === opp.playerId
        ? "PlayerOneWin"
        : "PlayerTwoWin";

    socket.nsp.to(room.id).socketsLeave(room.id);

    await ticTacToeService.finishGame(
      room.gameId,
      gameResult,
      opp.playerId,
      leavingPlayer.playerId,
    );

    try {
      socket.user(opp.userId).emit("opponent_left", {
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

