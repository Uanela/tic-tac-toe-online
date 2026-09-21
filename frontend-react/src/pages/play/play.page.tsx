import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Swords, Handshake, Trophy, Frown, DoorOpen, Flag } from "lucide-react";
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
import { LeaveMatchModal } from "./components/leave-match-modal";
import { WaitTimer } from "./components/wait-timer";
import styles from "./play-page.module.css";
import { useToast } from "../../utils/contexts/toast.context";
import { Button } from "../../components/button";
import { PlayerModal } from "../../components/player-modal";
import { Link } from "../../components/link";
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

const HIGHLIGHT_MS = 1000;
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
  const toast = useToast();

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

  // The `gameState` param outlives the room it names, and a throw in here blanks the app: no error boundary.
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

  // A mark is doomed on the turn of the side that placed the fourth, so this reads the turn rather than the mark.
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

  // Seeded from a restored room so a rejoin replays nothing it missed; state, not a ref, since handlers register during render.
  const [cues] = useState(() => new GameCues(restoredState ?? undefined));

  const [sentInvite, setSentInvite] = useState<{
    id: string;
    expiresAt: number;
  } | null>(null);
  const sentInviteId = sentInvite?.id ?? null;
  const [waitExpiresAt, setWaitExpiresAt] = useState<number | null>(null);
  const [forfeitPrompt, setForfeitPrompt] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const joinEmitter = game.useEmit<
    Record<string, never>,
    GameServerState | { waiting: true; expiresAt: number }
  >("join_game", { ack: true, timeout: 6000 });
  const moveEmitter = game.useEmit<{ roomId: string; index: number }>(
    "make_move",
    { ack: true, timeout: 5000 },
  );
  const sendInviteEmitter = game.useEmit<
    { targetUserId: string },
    { inviteId: string; expiresAt: number }
  >("send_invite", { ack: true, timeout: 6000 });

  const acceptInviteEmitter = game.useEmit<{ inviteId: string }>(
    "accept_invite",
    { ack: true, timeout: 6000 },
  );

  const cancelInviteEmitter = game.useEmit<{ inviteId: string }>(
    "cancel_invite",
    { ack: true, timeout: 6000 },
  );

  const leaveQueueEmitter = game.useEmit<Record<string, never>>("leave_queue", {
    ack: true,
    timeout: 6000,
  });

  const leaveGameEmitter = game.useEmit<Record<string, never>>("leave_game", {
    ack: true,
    timeout: 6000,
  });

  const declineInviteEmitter = game.useEmit<{ inviteId: string }>(
    "decline_invite",
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

  // The turn cue starts the tick, so here it only ever needs stopping.
  const boardLive = screen === "game" && gameState?.status === "playing";

  const inviteId = searchParams.get("inviteId") || null;

  // Also what a push opened the app on, so it waits behind the leave confirmation while a match is live.
  const promptInvite = boardLive ? inviteId : null;

  const acceptInvite = useCallback(
    async (id: string) => {
      const result = await acceptInviteEmitter.emit({ inviteId: id }, { ack: true });

      setOverlay(null);
      setWinningLine(null);
      setEnding(null);
      setSearchParams({});

      if (!result?.success)
        toast.show({
          variant: "error",
          description: result?.error ?? m.play_join_invite_missed(),
        });
    },
    [acceptInviteEmitter, setSearchParams, toast],
  );

  // An answer given in the toast: it waits behind the leave confirmation while a match is
  // live, exactly as a challenge taken from the play screen always has. Claimed by id
  // rather than by the parameter, so a rerender between the ask and the answer — the
  // emitter's own loading state is enough — cannot ask the same dead invite twice.
  const answeredInvite = useRef<string | null>(null);

  useEffect(() => {
    const id = searchParams.get("inviteId");

    if (!id || boardLive || searchParams.get("accept") !== "1") return;
    if (answeredInvite.current === id) return;

    answeredInvite.current = id;
    acceptInvite(id);
  }, [searchParams, boardLive, acceptInvite]);

  useEffect(() => {
    if (!boardLive) stopLoop("clockTicking");
  }, [boardLive, stopLoop]);

  useEffect(() => () => stopLoop("clockTicking"), [stopLoop]);

  // A challenge sent from a player card on another page arrives as a parameter, here, where its countdown and cancel live.
  useEffect(() => {
    const target = searchParams.get("challenge");
    if (!target) return;

    setSearchParams({}, { replace: true });
    handleSendInvite(target);
  }, [searchParams, setSearchParams]);

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

      // The board settles the invite, and the search loop hangs off that invite.
      setSentInvite(null);

      setGameState(state);
      setCounter(10);

      const fired = cues.read(data);
      for (const cue of fired) {
        switch (cue.kind) {
          case "makeMove":
            if (cue.mark === state.me.mark) playMove(cue.mark);
            else play("changingTurn");
            break;
          case "changingTurn":
            if (screen === "game") restartLoop("clockTicking", { volume: 0.2 });
            break;
          default:
            play(cue.kind);
        }
      }

      if (!data.result) {
        setTimeLeft(data.timeLeftMs ?? null);

        // A rematch lands here while the last game's summary is still up, so the board has to come back.
        setOverlay(null);
        setWinningLine(null);
        setEnding(null);

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

      await refreshPlayer();
    },
    [player, play, playMove, restartLoop, screen, cues],
  );

  const clearSentInvite = (data: { inviteId?: string }) => {
    setSentInvite((prev) => (prev?.id === data?.inviteId ? null : prev));
  };

  game.on<{ inviteId?: string }>("invite_declined", clearSentInvite);
  game.on<{ inviteId?: string }>("invite_expired", clearSentInvite);

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

    if (!result?.success || !result.data) {
      toast.show({
        variant: "error",
        description: result?.error || m.play_join_no_opponent(),
      });
      return;
    }

    if ("waiting" in result.data) {
      setWaitExpiresAt(result.data.expiresAt);
      setScreen("waiting");
      return;
    }
    handleGameServerState(result.data);
  }

  async function handleSendInvite(targetUserId: string) {
    setInvitingId(targetUserId);
    const result = await sendInviteEmitter.emit(
      { targetUserId },
      { ack: true },
    );
    setInvitingId(null);

    if (!result?.success || !result.data)
      return toast.show({
        variant: "error",
        description: result?.error || m.play_join_invite_failed(),
      });

    setSentInvite({
      id: result.data.inviteId,
      expiresAt: result.data.expiresAt,
    });
    setSearchQuery("");
    setSearchResults([]);
  }

  async function handleCancelInvite() {
    if (!sentInviteId) return;

    const result = await cancelInviteEmitter.emit(
      { inviteId: sentInviteId },
      { ack: true },
    );

    if (!result?.success)
      return toast.show({
        variant: "error",
        description: result?.error || m.play_join_cancel_failed(),
      });

    setSentInvite(null);
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

  function leaveTable() {
    setOverlay(null);
    setWinningLine(null);
    setEnding(null);
    setSentInvite(null);
    setGameState(null);
  }

  function handleRematch() {
    // Read before leaving, since leaving is what drops the state it lives on.
    const opponentUserId = gameState?.opponent.userId;

    leaveTable();
    setScreen("join");
    if (opponentUserId) handleSendInvite(opponentUserId);
  }

  function handleNewOpponent() {
    leaveTable();
    setScreen("waiting");
    handleJoin();
  }

  async function handleConfirmLeave() {
    const result = await leaveGameEmitter.emit({}, { ack: true });
    setForfeitPrompt(false);

    if (!result?.success)
      return toast.show({
        variant: "error",
        description: result?.error || m.leave_failed(),
      });

    // Clearing the board is what releases a waiting invite.
    leaveTable();
    setScreen("join");
  }

  function handleCancelLeave() {
    setForfeitPrompt(false);

    if (!promptInvite) return;

    // The challenge was shown and passed over, so the inviter hears it now rather than watching their own timer run out.
    declineInviteEmitter.emit({ inviteId: promptInvite }, { ack: true });
    setSearchParams({ inviteId: "" });
  }

  function handleContinue() {
    leaveTable();
    setScreen("join");
  }

  async function handleCancelWait() {
    const result = await leaveQueueEmitter.emit({}, { ack: true });

    if (!result?.success)
      return toast.show({
        variant: "error",
        description: result?.error || m.play_join_cancel_failed(),
      });

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

          <Button
            className="btn"
            onClick={handleJoin}
            disabled={
              game.status !== "connected" ||
              joinEmitter.loading ||
              !!sentInviteId
            }
          >
            {joinEmitter.loading ? m.play_join_finding() : m.play_join_find()}
          </Button>

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
              {sentInvite && <WaitTimer until={sentInvite.expiresAt} />}
              <Button className="btn ghost" onClick={handleCancelInvite}>
                {m.play_join_cancel()}
              </Button>
            </div>
          ) : (
            <div className={styles.invitePanel}>
              <div className={styles.searchBox}>
                <input
                  className="input"
                  placeholder={m.play_join_search_placeholder()}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searching && <span className={styles.searchSpinner} />}
              </div>

              {searchResults.length > 0 && (
                <div className={styles.searchResults}>
                  {searchResults.map((p) => (
                    <PlayerRow
                      key={p.userId}
                      player={p}
                      inviting={invitingId === p.userId}
                      sending={sendInviteEmitter.loading}
                      onOpen={() => setOpenId(p.id)}
                      onChallenge={() => handleSendInvite(p.userId)}
                    />
                  ))}
                </div>
              )}

              {searchQuery.trim() &&
                !searching &&
                searchResults.length === 0 && (
                  <p className={styles.hint}>{m.play_join_none_found()}</p>
                )}

              {!searchQuery.trim() && (
                <div>
                  <div
                    style={{
                      marginTop: 32,
                      marginBottom: 16,
                      fontWeight: "bold",
                    }}
                  >
                    <p>{m.play_join_online_title()}</p>
                  </div>

                  <div className={styles.searchResults}>
                    {players?.map(
                      (p: PlayerOnGame) =>
                        p.id !== player.id && (
                          <PlayerRow
                            key={p.userId}
                            player={p}
                            inviting={invitingId === p.userId}
                            sending={sendInviteEmitter.loading}
                            onOpen={() => setOpenId(p.id)}
                            onChallenge={() => handleSendInvite(p.userId)}
                          />
                        ),
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
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
          {waitExpiresAt && <WaitTimer until={waitExpiresAt} />}
          <Button className="btn ghost" onClick={handleCancelWait}>
            {m.play_join_cancel()}
          </Button>
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
          {boardLive && (
            <Button
              className={`btn ghost ${styles.giveUp}`}
              onClick={() => setForfeitPrompt(true)}
            >
              <Flag size={15} />
              {m.play_give_up()}
            </Button>
          )}
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
          // A player who walked out cannot be challenged, and their id is already gone from the state.
          canRematch={overlay.kind !== "left"}
          onRematch={handleRematch}
          onNewOpponent={handleNewOpponent}
          onContinue={handleContinue}
        />
      )}

      {(promptInvite !== null || forfeitPrompt) && (
        <LeaveMatchModal
          title={m.leave_title()}
          body={promptInvite ? m.leave_body_invite() : m.leave_body_forfeit()}
          confirmLabel={m.leave_confirm()}
          cancelLabel={m.leave_stay()}
          busy={leaveGameEmitter.loading}
          onConfirm={handleConfirmLeave}
          onCancel={handleCancelLeave}
        />
      )}

      {openId && (
        <PlayerModal
          key={openId}
          playerId={openId}
          onChallenge={(userId) => {
            setOpenId(null);
            handleSendInvite(userId);
          }}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

/** One row of either player list, so a change to what a row offers lands on both. */
function PlayerRow({
  player,
  inviting,
  sending,
  onOpen,
  onChallenge,
}: {
  player: Player;
  inviting: boolean;
  sending: boolean;
  onOpen: () => void;
  onChallenge: () => void;
}) {
  return (
    <div className={styles.searchRow}>
      {/* A sibling of the challenge button, never its parent: a button cannot nest one. */}
      <Button
        type="button"
        className={styles.searchInfo}
        onClick={onOpen}
        title={m.player_modal_title()}
      >
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
            className={`${styles.dot} ${player.isOnline ? styles.connected : ""}`}
          ></p>
          {player.nickname}
        </span>
        <span style={{ marginLeft: 10 }} className={styles.searchXp}>
          {m.xp_upper({ xp: formatNumber(player.xp) })}
        </span>
      </Button>

      <Button
        className={`btn ${styles.challengeBtn}`}
        onClick={onChallenge}
        disabled={inviting || sending}
        aria-label={m.play_join_challenge()}
      >
        <Swords size={16} />
      </Button>
    </div>
  );
}

function endingFor(overlay: Overlay) {
  switch (overlay.kind) {
    case "draw":
      return {
        icon: <Handshake size={ 48 } color="var(--accent)" />,
        title: m.play_overlay_draw_title(),
        sub: m.play_overlay_draw_sub(),
        xpGained: XP_MAP.draw,
      };
    case "win":
      return {
        icon: <Trophy size={ 48 } color="var(--x-color)" />,
        title: m.play_overlay_win_title(),
        sub: m.play_overlay_win_sub({ nickname: overlay.nickname }),
        titleColor: "var(--x-color)",
        xpGained: XP_MAP.win,
      };
    case "lose":
      return {
        icon: <Frown size={ 48 } color="var(--error)" />,
        title: m.play_overlay_lose_title(),
        sub: m.play_overlay_lose_sub({ nickname: overlay.nickname }),
        titleColor: "var(--error)",
        xpGained: XP_MAP.loss,
      };
    case "left":
      return {
        icon: <DoorOpen size={ 48 } color="var(--muted)" />,
        title: m.play_overlay_left_title(),
        // The server composes this one, so it is not translated on the client.
        sub: overlay.message,
        xpGained: XP_MAP.win,
      };
  }
}

