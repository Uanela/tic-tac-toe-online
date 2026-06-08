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
import { useFetch } from "../../hooks/use-fetch";

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

  const { data: { data: players } = { data: null, count: 0 } } = useFetch(
    "/players/public/online"
  );

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

      if (!data.result) {
        setScreen("game");
      } else {
        {
          /* setTimeout(() => { */
        }
        {
          /*   if (gameState && gameState?.status === "finished") setGameState(null); */
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
    if (!result?.success) {
      setToast(
        result.error ||
          (result as any).message ||
          "Nǡo foi possivel encontrar adversário"
      );
      return;
    }
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
      !gameState ||
      gameState?.currentTurn !== gameState?.me.mark ||
      gameState?.board[index] !== null ||
      !gameState?.roomId
    )
      return;

    const result = await moveEmitter.emit(
      { roomId: gameState.roomId, index },
      { ack: true }
    );

    if (result.success) {
      setPoppedCell(index);
      setTimeout(() => setPoppedCell(null), 220);
    }
    /* if (!result?.success) ; */
  }

  function handlePlayAgain(type?: "invite") {
    setOverlay(null);
    setSentInviteId(null);
    setScreen("join");
    if (type === "invite") handleSendInvite(gameState?.opponent.userId!);
    setTimeout(() => {
      setGameState(null);
    }, 250);
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
            {joinEmitter.loading ? "Finding match…" : "Procurar Adversário"}
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

              {inviteOpen ? (
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
              ) : (
                <div>
                  <div
                    className={styles.header}
                    style={{
                      marginTop: 32,
                      marginBottom: 16,
                      marginInline: "block",
                      fontWeight: "bold",
                    }}
                  >
                    <p>Jogadores Online</p>
                  </div>

                  <div className={styles.searchResults}>
                    {players?.map(
                      (p: PlayerOnGame) =>
                        p.id !== player.id && (
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
                              {invitingId === p.userId
                                ? "Sending…"
                                : "Challenge"}
                            </button>
                          </div>
                        )
                    )}
                  </div>
                </div>
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

      {screen === "game" && gameState && (
        <div className={styles.screen}>
          <Scoreboard data={gameState} />
          <div
            className={`${styles.turnBanner} ${gameState?.me.myTurn ? styles.myTurn : styles.theirTurn}`}
          >
            {gameState?.me.myTurn ? "▶ Your turn" : "Opponent thinking…"}{" "}
            {counter} sec
          </div>
          <Board
            board={gameState?.board || []}
            isMyTurn={!!gameState?.me.myTurn}
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
