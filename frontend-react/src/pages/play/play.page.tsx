import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { useGateway } from "@arkosjs/react-websockets";
import { useAuth } from "../../utils/contexts/auth.context";
import { Board } from "./components/board";
import { Scoreboard } from "./components/scoreboard";
import { GameOverOverlay } from "./components/game-over-overlay";
import styles from "./play-page.module.css";

type Mark = "X" | "O";
type Cell = Mark | null;
type Screen = "join" | "waiting" | "game";

interface GameStartData {
  roomId: string;
  board: Cell[];
  yourMark: Mark;
  opponentNickname: string;
  currentTurn: Mark;
}

interface MoveMadeData {
  board: Cell[];
  index: number;
  mark: Mark;
  currentTurn: Mark;
}

interface GameOverData {
  board: Cell[];
  result: Mark | "draw";
  winnerNickname: string | null;
}

interface OpponentLeftData {
  message: string;
}

const XP_MAP = { win: 50, draw: 15, loss: 5 };

export default function PlayPage() {
  const { user, player, refreshPlayer } = useAuth();
  const game = useGateway("/tic-tac-toe");

  useEffect(() => {
    try {
      if (user) game.raw.rawSocket.connect();
    } catch (err) {
      console.log(err);
    }
    return () => {
      game.raw.rawSocket.disconnect();
    };
  }, [user]);

  const [screen, setScreen] = useState<Screen>("join");
  const [myMark, setMyMark] = useState<Mark | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [currentTurn, setCurrentTurn] = useState<Mark>("X");
  const [gameActive, setGameActive] = useState(false);
  const [nameX, setNameX] = useState("—");
  const [nameO, setNameO] = useState("—");
  const [poppedCell, setPoppedCell] = useState<number | null>(null);
  const [overlay, setOverlay] = useState<{
    emoji: string;
    title: string;
    sub: string;
    titleColor?: string;
    xpGained?: number;
  } | null>(null);

  const joinEmitter = game.useEmit<{ nickname?: string }>("join_game", {
    ack: true,
    timeout: 6000,
  });
  const moveEmitter = game.useEmit<{ roomId: string; index: number }>(
    "make_move",
    { ack: true, timeout: 5000 }
  );

  const handleGameStart = useCallback(
    (data: GameStartData) => {
      if (!data) return;
      setMyMark(data.yourMark);
      setRoomId(data.roomId);
      setBoard([...data.board]);
      setCurrentTurn(data.currentTurn);
      setGameActive(true);
      if (data.yourMark === "X") {
        setNameX(player?.nickname ?? "You");
        setNameO(data.opponentNickname);
      } else {
        setNameX(data.opponentNickname);
        setNameO(player?.nickname ?? "You");
      }
      setScreen("game");
    },
    [player]
  );

  game.on<GameStartData>("game_start", handleGameStart);

  game.on<MoveMadeData>("move_made", (data) => {
    setBoard([...data.board]);
    setCurrentTurn(data.currentTurn);
    setPoppedCell(data.index);
    setTimeout(() => setPoppedCell(null), 220);
  });

  game.on<GameOverData>("game_over", async (data) => {
    setBoard([...data.board]);
    setGameActive(false);
    await refreshPlayer();

    if (data.result === "draw") {
      setOverlay({
        emoji: "🤝",
        title: "Draw!",
        sub: "Well played by both.",
        xpGained: XP_MAP.draw,
      });
    } else if (data.result === myMark) {
      setOverlay({
        emoji: "🏆",
        title: "You win!",
        sub: `${data.winnerNickname} claims victory`,
        titleColor: "var(--x-color)",
        xpGained: XP_MAP.win,
      });
    } else {
      setOverlay({
        emoji: "😤",
        title: "You lose",
        sub: `${data.winnerNickname} wins this round`,
        titleColor: "var(--error)",
        xpGained: XP_MAP.loss,
      });
    }
  });

  game.on<OpponentLeftData>("opponent_left", async (data) => {
    setGameActive(false);
    await refreshPlayer();
    setOverlay({
      emoji: "🚪",
      title: "Opponent left",
      sub: data.message,
      xpGained: XP_MAP.win,
    });
  });

  async function handleJoin() {
    const result = await joinEmitter.emit({}, { ack: true });
    console.log(result, "sent");
    if (!result?.success) return;
    if ((result.data as any)?.waiting) {
      setScreen("waiting");
      return;
    }
    handleGameStart(result.data as GameStartData);
  }

  async function handleCellClick(index: number) {
    if (
      !gameActive ||
      currentTurn !== myMark ||
      board[index] !== null ||
      !roomId
    )
      return;

    const prev = [...board];
    setBoard((b) => {
      const next = [...b];
      next[index] = myMark!;
      return next;
    });

    const result = await moveEmitter.emit({ roomId, index }, { ack: true });
    if (!result?.success) setBoard(prev);
  }

  function handlePlayAgain() {
    setOverlay(null);
    setMyMark(null);
    setRoomId(null);
    setBoard(Array(9).fill(null));
    setCurrentTurn("X");
    setGameActive(false);
    setNameX("—");
    setNameO("—");
    setScreen("join");
  }

  function handleCancelWait() {
    game.raw.rawSocket.disconnect();
    game.raw.rawSocket.connect();
    setScreen("join");
  }

  if (!user) {
    return (
      <div className={styles.gate}>
        <h2>Sign in to play</h2>
        <p>You need an account to join ranked matches.</p>
        <div className={styles.gateCta}>
          <Link to="/auth/login" className="btn">
            Log in
          </Link>
          <Link to="/auth/signup" className="btn ghost">
            Sign up
          </Link>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className={styles.gate}>
        <h2>No player profile</h2>
        <p>
          Something went wrong with your player profile. Try signing up again.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.statusBar}>
        <span
          className={`${styles.dot} ${game.status === "connected" ? styles.connected : ""}`}
        />
        <span className={styles.statusText}>{game.status}</span>
      </div>

      {screen === "join" && (
        <div className={styles.screen}>
          <div className={styles.joinInfo}>
            <div className={styles.playerCard}>
              <span className={styles.playerMark}>?</span>
              <span className={styles.playerNick}>{player.nickname}</span>
              <span className={styles.playerXp}>{player.xp} XP</span>
            </div>
          </div>
          <button
            className="btn"
            onClick={handleJoin}
            disabled={game.status !== "connected" || joinEmitter.loading}
          >
            {joinEmitter.loading ? "Finding match…" : "Find opponent"}
          </button>
          <p className={styles.hint}>Open in two tabs to test locally.</p>
        </div>
      )}

      {screen === "waiting" && (
        <div className={styles.screen}>
          <div className={styles.waitingDots}>
            <span />
            <span />
            <span />
          </div>
          <p className={styles.hint}>Waiting for an opponent…</p>
          <button className="btn ghost" onClick={handleCancelWait}>
            Cancel
          </button>
        </div>
      )}

      {screen === "game" && (
        <div className={styles.screen}>
          <Scoreboard
            nameX={nameX}
            nameO={nameO}
            currentTurn={currentTurn}
            myMark={myMark}
          />

          <div
            className={`${styles.turnBanner} ${currentTurn === myMark ? styles.myTurn : styles.theirTurn}`}
          >
            {currentTurn === myMark ? "▶ Your turn" : "Opponent thinking…"}
          </div>

          <Board
            board={board}
            isMyTurn={gameActive && currentTurn === myMark}
            onCellClick={handleCellClick}
            poppedCell={poppedCell}
          />
        </div>
      )}

      {overlay && (
        <GameOverOverlay {...overlay} onPlayAgain={handlePlayAgain} />
      )}
    </div>
  );
}
