import { useState, useCallback, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useGateway } from "@arkosjs/react-websockets";
import { useAuth } from "../../utils/contexts/auth.context";
import { api } from "../../lib/api";
import { Board } from "./components/board";
import { Scoreboard } from "./components/scoreboard";
import { GameOverOverlay } from "./components/game-over-overlay";
import styles from "./play-page.module.css";
import { Toast } from "../../components/toast";
import OnlinePlayersCount from "./components/online-players-count";

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

interface PlayerResult {
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
  const location = useLocation();

  // ── core game state ───────────────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>(
    location.state?.["game_screen"] || "join"
  );
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

  // ── invite panel state ────────────────────────────────────────────────────
  const [sentInviteId, setSentInviteId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null); // userId being invited

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

  const inviteId = location.state?.["inviteId"];

  useEffect(() => {
    if (!inviteId) return;

    async function accept() {
      const result = await acceptInviteEmitter.emit(
        { inviteId },
        { ack: true }
      );

      if (!result?.success) {
        setToast(result?.error ?? "Invite already expired");
        return;
      }
    }

    accept();
  }, [inviteId]);

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
        const res = await api.get<{ data: PlayerResult[] }>(
          `/players/public?nickname__icontains=${encodeURIComponent(q)}&limit=6`
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

  // ── game handlers ─────────────────────────────────────────────────────────
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
    setGameActive(true);
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
        sub: `You beat ${data.winnerNickname}!`,
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

  // ── actions ───────────────────────────────────────────────────────────────
  async function handleJoin() {
    const result = await joinEmitter.emit({}, { ack: true });
    if (!result?.success) return;
    if ((result.data as any)?.waiting) {
      setScreen("waiting");
      return;
    }
    handleGameStart(result.data as GameStartData);
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
    setSentInviteId(result.data.inviteId);
    setSearchQuery("");
    setSearchResults([]);
  }

  function handleCancelInvite() {
    // Server will auto-expire, just clear local state
    setSentInviteId(null);
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
    setCurrentTurn(currentTurn === "X" ? "O" : "X");
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
    setSentInviteId(null);
    setScreen("join");
  }

  function handleCancelWait() {
    game.raw.rawSocket.connect();
    setScreen("join");
  }

  // ── guards ────────────────────────────────────────────────────────────────
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

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.statusBar}>
        <span
          className={`${styles.dot} ${game.status === "connected" ? styles.connected : ""}`}
        />
        <span className={styles.statusText}>{game.status}</span>{" "}
      </div>

      {screen !== "game" && <OnlinePlayersCount />}

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
            disabled={
              game.status !== "connected" ||
              joinEmitter.loading ||
              !!sentInviteId
            }
          >
            {joinEmitter.loading ? "Finding match…" : "Find opponent"}
          </button>

          <div className={styles.divider}>
            <span>or challenge someone</span>
          </div>

          {/* ── invite panel ── */}

          {sentInviteId ? (
            <div className={styles.invitePending}>
              <div className={styles.waitingDots}>
                <span />
                <span />
                <span />
              </div>
              <p className={styles.hint}>Waiting for opponent to accept…</p>
              <button className="btn ghost" onClick={handleCancelInvite}>
                Cancel
              </button>
            </div>
          ) : (
            <div className={styles.invitePanel}>
              <button
                className={`btn ghost ${styles.inviteToggle}`}
                onClick={() => {
                  setInviteOpen((o) => !o);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                {inviteOpen ? "✕ Close" : "⚔️ Challenge a player"}
              </button>

              {inviteOpen && (
                <>
                  <div className={styles.searchBox}>
                    <input
                      className="input"
                      placeholder="Search by nickname…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                    {searching && <span className={styles.searchSpinner} />}
                  </div>

                  {searchResults.length > 0 && (
                    <div className={styles.searchResults}>
                      {searchResults.map((p) => (
                        <div key={p.userId} className={styles.searchRow}>
                          <div className={styles.searchInfo}>
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                              className={styles.searchNick}
                            >
                              <p
                                style={{
                                  width: 8,
                                  height: 8,
                                }}
                                className={`${styles.dot} ${p.isOnline ? styles.connected : ""}`}
                              ></p>
                              {p.nickname}
                            </span>
                            <span
                              style={{ marginLeft: 10 }}
                              className={styles.searchXp}
                            >
                              {p.xp} XP
                            </span>
                          </div>
                          <button
                            className="btn"
                            onClick={() => handleSendInvite(p.userId)}
                            disabled={
                              invitingId === p.userId ||
                              sendInviteEmitter.loading
                            }
                          >
                            {invitingId === p.userId ? "Sending…" : "Challenge"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchQuery.trim() &&
                    !searching &&
                    searchResults.length === 0 && (
                      <p className={styles.hint}>No players found</p>
                    )}
                </>
              )}
            </div>
          )}

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
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
