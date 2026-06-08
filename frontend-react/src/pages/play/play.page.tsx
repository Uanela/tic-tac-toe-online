import { useState, useCallback, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useGateway } from "@arkosjs/react-websockets";
import { useAuth } from "../../utils/contexts/auth.context";
import { api } from "../../lib/api";
import { Board } from "./components/board";
import { Scoreboard } from "./components/scoreboard";
import { GameOverOverlay } from "./components/game-over-overlay";
import styles from "./play-page.module.css";
import { Toast } from "../../components/toast";
import OnlinePlayersCount from "./components/online-players-count";
import useInterval from "../../hooks/use-interval";

// feat: Instantiate notification sound objects from the public directory
const joinSound = new Audio("/sounds/join-sound.mp3");
joinSound.preload = "auto";
const inviteSound = new Audio("/sounds/invite_sound.mp3");
joinSound.preload = "auto";


type Mark = "X" | "O";
type Cell = Mark | null;
type Screen = "join" | "waiting" | "game";

export interface GameState {
  roomId: string;
  board: Cell[];
  currentTurn: Mark;
  players: PlayerOnGame[];
  me: PlayerOnGame;
  opponent: PlayerOnGame;
  playerX: PlayerOnGame;
  playerO: PlayerOnGame;
  winner: PlayerOnGame | null;
  loser: PlayerOnGame | null;
  status: "playing" | "finished" | "starting";
}

interface GameServerState {
  roomId: string;
  id: string;
  board: Cell[];
  currentTurn: Mark;
  players: PlayerOnGame[];
  status: "playing" | "finished" | "starting";
  lastUpdate: Date;
  lastMove: { index: number; mark: Mark } | null;
  result: Mark | null | "draw";
  counter: number;
}

interface PlayerOnGame extends Player {
  mark: "X" | "O";
  myTurn: boolean;
}

interface OpponentLeftData {
  message: string;
}

interface Player {
  id: string;
  userId: string;
  nickname: string;
  xp: number;
  isOnline: boolean;
}

const XP_MAP = { win: 50, draw: 15, loss: 5 };

export default function PlayPage() {
  const { user, player, refreshPlayer } = useAuth();
  const game = useGateway("/tic-tac-toe");

  const [searchParams, setSearchParams] = useSearchParams();

  // ── core game state ───────────────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>(
    (searchParams.get("gameScreen") as Screen) || "join"
  );
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [counter, setCounter] = useState(0);

  useInterval(
    () => {
      setCounter((prev) => (prev - 1 <= 0 ? 0 : prev - 1));
    },
    gameState ? 1000 : 0
  );

  const [poppedCell, setPoppedCell] = useState<number | null>(null);
  const [overlay, setOverlay] = useState<{
    emoji: string;
    title: string;
    sub: string;
    titleColor?: string;
    xpGained?: number;
  } | null>(null);

  // ── invite panel state ────────────────────────────────────────────────────
  const [sentInviteId, setSentInviteId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null); // userId being invited
  {
    /* const [timer, setTimer] = useState(5); */
  }

  // ── emitters ──────────────────────────────────────────────────────────────
  const joinEmitter = game.useEmit<{}>("join_game", {
    ack: true,
    timeout: 6000,
  });
  const moveEmitter = game.useEmit<{ roomId: string; index: number }>(
    "make_move",
    { ack: true, timeout: 5000 }
  );
  const sendInviteEmitter = game.useEmit<{ targetUserId: string }>(
    "send_invite",
    { ack: true, timeout: 6000 }
  );

  const acceptInviteEmitter = game.useEmit<{ inviteId: string }>(
    "accept_invite",
    { ack: true, timeout: 6000 }
  );

  // ── socket connect ────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      if (user) game.raw.rawSocket.connect();
    } catch (err) {
      console.log(err);
    }
    return () => {};
  }, [user]);

  useEffect(() => {
    const inviteId = searchParams.get("inviteId");

    if (!inviteId) return;

    async function accept() {
      if (!inviteId) return;

      const result = await acceptInviteEmitter.emit(
        { inviteId },
        { ack: true }
      );
      setOverlay(null);

      if (!result?.success && inviteId) {
        setToast(result?.error ?? "Invite already expired");
        return;
      }

      // feat: Play notification sound when an invitation is successfully accepted
      inviteSound.play().catch((err) => console.log("Failed to play invite sound:", err));

      setSearchParams({ inviteId: "" });
    }

    accept();
  }, [searchParams]);

  const [toast, setToast] = useState<string | null>(null); // if not already there

  // ── player search ─────────────────────────────────────────────────────────
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get<{ data: Player[] }>(
          `/players/public?nickname__icontains=${encodeURIComponent(q.trim())}&limit=6`
        );
        // exclude yourself
        setSearchResults((res.data ?? []).filter((p) => p.userId !== user?.id));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  function getGameState(data: GameServerState): GameState {
    const me = data.players.find((p) => p.id === player?.id)!;
    const opponent = data.players.find((p) => p.id !== player?.id)!;
    const playerX = data.players[0];
    const playerO = data.players[1];

    return {
      ...data,
      me: { ...me, myTurn: data.currentTurn === me.mark },
      opponent: { ...opponent, myTurn: data.currentTurn === opponent.mark },
      playerX: data.players[0],
      playerO: data.players[1],
      winner:
        data.status === "finished" && data.result === "X" ? playerX : null,
      loser: data.status === "finished" && data.result === "O" ? playerO : null,
    };
  }

  // ── game handlers ─────────────────────────────────────────────────────────
  const handleGameServerState = useCallback(
    async (data: GameServerState) => {
      if (!data) return;
      const state = getGameState(data);
      setGameState(state);
      setCounter(10);

      if (data.lastMove) {
        setPoppedCell(data.lastMove?.index);
        setTimeout(() => setPoppedCell(null), 220);
      }

      if (!data.result) {
        // feat: Check if screen transitions into game phase, then play entering match notification sound
        setScreen((prevScreen) => {
          if (prevScreen !== "game") {
            joinSound.play().catch((err) => console.log("Failed to play join sound:", err));
          }
          return "game";
        });
      } else {
        {
          /* setTimeout(() => { */
        }
        {
          /* if (gameState && gameState?.status === "finished") setGameState(null); */
        }
        {
          /* }, 15000); */
        }

        await refreshPlayer();

        if (
          (data.status === "finished" && !data.result) ||
          data.result === "draw"
        ) {
          setOverlay({
            emoji: "🤝",
            title: "Draw!",
            sub: "Well played by both.",
            xpGained: XP_MAP.draw,
          });
        } else if (data.result === state.me.mark) {
          setOverlay({
            emoji: "🏆",
            title: "You win!",
            sub: `You beat ${state.loser?.nickname}!`,
            titleColor: "var(--x-color)",
            xpGained: XP_MAP.win,
          });
        } else {
          setOverlay({
            emoji: "😤",
            title: "You lose",
            sub: `${state.winner?.nickname} wins this round`,
            titleColor: "var(--error)",
            xpGained: XP_MAP.loss,
          });
        }
      }
    },
    [player]
  );

  game.on<GameServerState>("game_state", handleGameServerState);

  game.on<OpponentLeftData>("opponent_left", async (data) => {
    setGameState(null);
    await refreshPlayer();
    setOverlay({
      emoji: "🚪",
      title: "Opponent left",
      sub: data.message,
      xpGained: XP_MAP.win,
    });
  });

  // ── actions ───────────────────────────────────────────────────────────────
  async function handleJoin() {
    const result = await joinEmitter.emit({}, { ack: true });
    if (!result?.success) return;
    if ((result.data as any)?.waiting) {
      setScreen("waiting");
      return;
    }
    handleGameServerState(result.data as GameServerState);
  }

  async function handleSendInvite(targetUserId: string) {
    setInvitingId(targetUserId);
    const result = await sendInviteEmitter.emit(
      { targetUserId },
      { ack: true }
    );
    setInvitingId(null);

    if (!result?.success)
      return setToast(result.error || "Couldn't send invite");

    setSentInviteId