import { useState, useCallback, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useGateway } from "@arkosjs/react-websockets";
import { useAuth } from "../../utils/contexts/auth.context";
import { useSound } from "../../utils/contexts/sound.context";
import { GameCues } from "./game-cues";
import { api } from "../../lib/api";
import { formatNumber } from "../../lib/format";
import { m } from "../../paraglide/messages.js";
import { Board } from "./components/board";
import { Scoreboard } from "./components/scoreboard";
import { GameOverOverlay } from "./components/game-over-overlay";
import { MatchFoundScreen } from "./components/match-found-screen";
import { MatchClock } from "./components/match-clock";
import styles from "./play-page.module.css";
import { Toast } from "../../components/toast";
import OnlinePlayersCount from "./components/online-players-count";
import useInterval from "../../hooks/use-interval";
import { useFetch } from "../../hooks/use-fetch";

type Mark = "X" | "O";
type Cell = Mark | null;
type Screen = "join" | "waiting" | "starting" | "game";

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
  /** Absent from a state restored out of an older `gameState` query param. */
  doomed?: Doomed;
}

type Doomed = Record<Mark, number | null>;

export interface GameServerState {
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
  /** The cell the cap evicts on each side's next placement, or null under three marks. */
  doomed?: Doomed;
  winningLine?: number[] | null;
  timeLeftMs?: number;
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

const HIGHLIGHT_MS = 3000;
const CLOCK_TICK_MS = 1000;
const CLOCK_WARN_MS = 10_000;
const SEARCH_DUCK = 0.7;

/** A kind rather than the words, so an overlay already on screen re-translates. */
type Overlay =
  | { kind: "draw" }
  | { kind: "win"; nickname: string }
  | { kind: "lose"; nickname: string }
  | { kind: "left"; message: string };

interface PendingEnding {
  stinger: "win" | "lose" | "draw";
  overlay: Extract<Overlay, { kind: "win" | "lose" | "draw" }>;
  delayMs: number;
}

export default function PlayPage() {
  const { user, player, refreshPlayer } = useAuth();
  const game = useGateway("/tic-tac-toe");
  const { play, playMove, duckMusic, unduckMusic, restartLoop, stopLoop } =
    useSound();

  const [searchParams, setSearchParams] = useSearchParams();

  const { data: { data: players } = { data: null, count: 0 } } = useFetch(
    "/players/public/online",
  );

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

  // The `gameState` param outlives the room it names — a reload, a stale tab, a server
  // restart — so it is untrusted, and a throw in here blanks the app: no error boundary.
  const [restoredState] = useState<GameState | null>(() => {
    const raw = searchParams.get("gameState");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as GameServerState;
      // A torn-down room leaves no players, and getGameState dereferences them.
      if (!Array.isArray(parsed?.players) || parsed.players.length < 2)
        return null;
      return getGameState(parsed);
    } catch {
      return null;
    }
  });
  const [screen, setScreen] = useState<Screen>(
    searchParams.get("gameScreen") === "game" && restoredState
      ? "game"
      : "join",
  );
  const [gameState, setGameState] = useState<GameState | null>(restoredState);
  const [counter, setCounter] = useState(0);

  // Interpolated between the server's snapshots; each one resets it to the truth.
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useInterval(
    () => {
      setCounter((prev) => (prev - 1 <= 0 ? 0 : prev - 1));
      setTimeLeft((prev) =>
        prev === null ? null : Math.max(0, prev - CLOCK_TICK_MS),
      );
    },
    gameState ? CLOCK_TICK_MS : 0,
  );

  const clockCritical = timeLeft !== null && timeLeft <= CLOCK_WARN_MS;

  // Keyed on the crossing, not the reading: otherwise it cues once per tick below the mark.
  useEffect(() => {
    if (clockCritical) play("dimmed");
  }, [clockCritical, play]);

  const [poppedCell, setPoppedCell] = useState<number | null>(null);

  // A mark is only ever doomed on the turn of the side that placed the fourth, so this
  // reads the turn rather than the mark — and both players see it dimmed, not just its owner.
  const doomedCell = gameState?.doomed?.[gameState.currentTurn] ?? null;

  const [overlay, setOverlay] = useState<Overlay | null>(null);

  // Held apart from the overlay so the board is seen lit up before anything lands on it.
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [ending, setEnding] = useState<PendingEnding | null>(null);

  useEffect(() => {
    if (!ending) return;

    const id = window.setTimeout(() => {
      play(ending.stinger);
      setOverlay(ending.overlay);
    }, ending.delayMs);

    return () => clearTimeout(id);
  }, [ending, play]);

  // Seeded from a restored room so a rejoin replays nothing it missed. State, not a
  // ref: the handlers register during render, where a ref cannot be read.
  const [cues] = useState(() => new GameCues(restoredState ?? undefined));

  const [sentInviteId, setSentInviteId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const joinEmitter = game.useEmit<{}>("join_game", {
    ack: true,
    timeout: 6000,
  });
  const moveEmitter = game.useEmit<{ roomId: string; index: number }>(
    "make_move",
    { ack: true, timeout: 5000 },
  );
  const sendInviteEmitter = game.useEmit<{ targetUserId: string }>(
    "send_invite",
    { ack: true, timeout: 6000 },
  );

  const acceptInviteEmitter = game.useEmit<{ inviteId: string }>(
    "accept_invite",
    { ack: true, timeout: 6000 },
  );

  useEffect(() => {
    try {
      if (user) game.raw.rawSocket.connect();
    } catch (err) {
      console.log(err);
    }
    return () => {};
  }, [user]);

  // The turn cue starts the tick, so here it only ever needs stopping: for endings the
  // cue stream never sees, and for leaving mid-match, which never changes `boardLive`.
  const boardLive = screen === "game" && gameState?.status === "playing";

  useEffect(() => {
    if (!boardLive) stopLoop("clockTicking");
  }, [boardLive, stopLoop]);

  useEffect(() => () => stopLoop("clockTicking"), [stopLoop]);

  useEffect(() => {
    const inviteId = searchParams.get("inviteId");

    if (!inviteId) return;

    async function accept() {
      if (!inviteId) return;

      const result = await acceptInviteEmitter.emit(
        { inviteId },
        { ack: true },
      );
      setOverlay(null);

      if (!result?.success && inviteId) {
        setToast(result?.error ?? m.play_join_invite_expired());
        return;
      }
      setSearchParams({ inviteId: "" });
    }

    accept();
  }, [searchParams]);

  const [toast, setToast] = useState<string | null>(null);

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
          `/players/public?nickname__icontains=${encodeURIComponent(q.trim())}&limit=6`,
        );
        setSearchResults((res.data ?? []).filter((p) => p.userId !== user?.id));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // The queue, the request still in flight and a pending invite all wear the same loop.
  const awaitingOpponent =
    screen === "waiting" || joinEmitter.loading || sentInviteId !== null;

  useEffect(() => {
    if (!awaitingOpponent) return;

    duckMusic("searching", SEARCH_DUCK);
    restartLoop("searchingOpponent");

    return () => {
      stopLoop("searchingOpponent");
      unduckMusic("searching");
    };
  }, [awaitingOpponent, duckMusic, unduckMusic, restartLoop, stopLoop]);

  const handleGameServerState = useCallback(
    async (data: GameServerState) => {
      if (!data) return;
      const state = getGameState(data);
      setGameState(state);
      setCounter(10);

      const fired = cues.read(data);
      for (const cue of fired) {
        switch (cue.kind) {
          case "makeMove":
            // My placements get the move cue, the opponent's get the "your move" one —
            // exactly one per placement, so neither has to fight for the speakers.
            if (cue.mark === state.me.mark) playMove(cue.mark);
            else play("changingTurn");
            break;
          case "changingTurn":
            // Every turn restarts the tick, including one the timeout handed over.
            if (screen === "game") restartLoop("clockTicking", { volume: 0.2 });
            break;
          default:
            play(cue.kind);
        }
      }

      if (!data.result) {
        setTimeLeft(data.timeLeftMs ?? null);

        // The match-found card runs over a game that is already live; nothing may cut it short.
        if (fired.some((cue) => cue.kind === "opponentFound"))
          setScreen("starting");
        else setScreen((prev) => (prev === "starting" ? prev : "game"));
        return;
      }

      setTimeLeft(null);

      // Annotated so the ending's own kind can name its stinger.
      const resolved: Extract<Overlay, { kind: "draw" | "win" | "lose" }> =
        data.result === "draw"
          ? { kind: "draw" }
          : data.result === state.me.mark
            ? { kind: "win", nickname: state.loser?.nickname ?? "" }
            : { kind: "lose", nickname: state.winner?.nickname ?? "" };

      // A draw has no line to light, so it skips straight to the stinger.
      const line = data.winningLine ?? null;
      setWinningLine(line);
      setEnding({
        stinger: resolved.kind,
        overlay: resolved,
        delayMs: line ? HIGHLIGHT_MS : 0,
      });

      if (line) play("winStrikeHighlight");

      // Only the XP counter, so it waits its turn: a round-trip must not delay the stinger.
      await refreshPlayer();
    },
    [player, play, playMove, restartLoop, screen, cues],
  );

  game.on<GameServerState>("game_state", handleGameServerState);
  game.on<OpponentLeftData>("opponent_left", async (data) => {
    setGameState(null);
    setTimeLeft(null);
    play("dimmed");
    await refreshPlayer();
    // The server composes this one, so it is not translated on the client.
    setOverlay({ kind: "left", message: data.message });
  });

  async function handleJoin() {
    const result = await joinEmitter.emit({}, { ack: true });
    if (!result?.success) {
      setToast(
        result.error || (result as any).message || m.play_join_no_opponent(),
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
      { ack: true },
    );
    setInvitingId(null);

    if (!result?.success)
      return setToast(result.error || m.play_join_invite_failed());

    setSentInviteId(result.data.inviteId);
    setSearchQuery("");
    setSearchResults([]);
  }

  function handleCancelInvite() {
    // The server expires the invite on its own; only the local state needs clearing.
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
      { ack: true },
    );

    if (result.success) {
      setPoppedCell(index);
      setTimeout(() => setPoppedCell(null), 220);
    }
  }

  function handlePlayAgain(type?: "invite") {
    setOverlay(null);
    setWinningLine(null);
    setEnding(null);
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

  // Stable, because the card reports completion from an effect that depends on it.
  const handleMatchFoundDone = useCallback(() => setScreen("game"), []);

  if (!user) {
    return (
      <div className={styles.gate}>
        <h2>{m.play_gate_sign_in_title()}</h2>
        <p>{m.play_gate_sign_in_sub()}</p>
        <div className={styles.gateCta}>
          <Link to="/auth/login" className="btn">
            {m.nav_login()}
          </Link>
          <Link to="/auth/signup" className="btn ghost">
            {m.nav_signup()}
          </Link>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className={styles.gate}>
        <h2>{m.play_gate_no_profile_title()}</h2>
        <p>{m.play_gate_no_profile_sub()}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {screen !== "game" && <OnlinePlayersCount />}

      {screen === "join" && (
        <div className={styles.screen}>
          <div className={styles.joinInfo}>
            <div className={styles.playerCard}>
              <span className={styles.playerMark}>?</span>
              <span className={styles.playerNick}>{player.nickname}</span>
              <span className={styles.playerXp}>
                {m.xp_upper({ xp: formatNumber(player.xp) })}
              </span>
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
            {joinEmitter.loading ? m.play_join_finding() : m.play_join_find()}
          </button>

          <div className={styles.divider}>
            <span>{m.play_join_or()}</span>
          </div>

          {sentInviteId ? (
            <div className={styles.invitePending}>
              <div className={styles.waitingDots}>
                <span />
                <span />
                <span />
              </div>
              <p className={styles.hint}>{m.play_join_pending()}</p>
              <button className="btn ghost" onClick={handleCancelInvite}>
                {m.play_join_cancel()}
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
                {inviteOpen
                  ? m.play_join_close()
                  : m.play_join_challenge_toggle()}
              </button>

              {inviteOpen ? (
                <>
                  <div className={styles.searchBox}>
                    <input
                      className="input"
                      placeholder={m.play_join_search_placeholder()}
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
                              {m.xp_upper({ xp: formatNumber(p.xp) })}
                            </span>
                          </div>
                          <button
                            className={`btn ${styles.challengeBtn}`}
                            onClick={() => handleSendInvite(p.userId)}
                            disabled={
                              invitingId === p.userId ||
                              sendInviteEmitter.loading
                            }
                            aria-label={ m.play_join_challenge() }
                          >
                            ⚔️
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchQuery.trim() &&
                    !searching &&
                    searchResults.length === 0 && (
                      <p className={styles.hint}>{m.play_join_none_found()}</p>
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
                    <p>{m.play_join_online_title()}</p>
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
                                {m.xp_upper({ xp: formatNumber(p.xp) })}
                              </span>
                            </div>
                            <button
                              className={`btn ${styles.challengeBtn}`}
                              onClick={() => handleSendInvite(p.userId)}
                              disabled={
                                invitingId === p.userId ||
                                sendInviteEmitter.loading
                              }
                              aria-label={ m.play_join_challenge() }
                            >
                              ⚔️
                            </button>
                          </div>
                        ),
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <p className={styles.hint}>{m.play_join_test_hint()}</p>
        </div>
      )}

      {screen === "waiting" && (
        <div className={styles.screen}>
          <div className={styles.waitingDots}>
            <span />
            <span />
            <span />
          </div>
          <p className={styles.hint}>{m.play_join_waiting()}</p>
          <button className="btn ghost" onClick={handleCancelWait}>
            {m.play_join_cancel()}
          </button>
        </div>
      )}

      {screen === "game" && gameState && (
        <div className={styles.screen}>
          <Scoreboard data={gameState} />
          {timeLeft !== null && <MatchClock timeLeftMs={timeLeft} />}
          <div
            className={`${styles.turnBanner} ${gameState?.me.myTurn ? styles.myTurn : styles.theirTurn}`}
          >
            {gameState?.me.myTurn ? m.play_turn_mine() : m.play_turn_theirs()}{" "}
            {m.play_turn_seconds({ seconds: counter })}
          </div>
          <Board
            board={gameState?.board || []}
            isMyTurn={!!gameState?.me.myTurn}
            onCellClick={handleCellClick}
            poppedCell={poppedCell}
            doomedCell={doomedCell}
            winningLine={winningLine}
          />
        </div>
      )}

      {screen === "starting" && gameState && (
        <MatchFoundScreen
          me={gameState.me.nickname}
          opponent={gameState.opponent.nickname}
          onDone={handleMatchFoundDone}
        />
      )}

      {overlay && (
        <GameOverOverlay
          {...endingFor(overlay)}
          onPlayAgain={handlePlayAgain}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

function endingFor(overlay: Overlay) {
  switch (overlay.kind) {
    case "draw":
      return {
        emoji: "🤝",
        title: m.play_overlay_draw_title(),
        sub: m.play_overlay_draw_sub(),
        xpGained: XP_MAP.draw,
      };
    case "win":
      return {
        emoji: "🏆",
        title: m.play_overlay_win_title(),
        sub: m.play_overlay_win_sub({ nickname: overlay.nickname }),
        titleColor: "var(--x-color)",
        xpGained: XP_MAP.win,
      };
    case "lose":
      return {
        emoji: "😤",
        title: m.play_overlay_lose_title(),
        sub: m.play_overlay_lose_sub({ nickname: overlay.nickname }),
        titleColor: "var(--error)",
        xpGained: XP_MAP.loss,
      };
    case "left":
      return {
        emoji: "🚪",
        title: m.play_overlay_left_title(),
        // The server composes this one, so it is not translated on the client.
        sub: overlay.message,
        xpGained: XP_MAP.win,
      };
  }
}

