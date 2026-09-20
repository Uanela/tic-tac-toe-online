import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Swords, X } from "lucide-react";
import { api } from "../lib/api";
import { formatDate, formatNumber } from "../lib/format";
import { m } from "../paraglide/messages.js";
import { useSound } from "../utils/contexts/sound.context";
import { Button } from "./button";
import { ChampionshipBadge } from "./championship-badge";
import styles from "./player-modal.module.css";

/** A settled game, read from the side of the player the card is showing. */
type MatchResult = "win" | "loss" | "draw";

/** Games per page. The card was carrying the whole history at once, which read as a wall. */
const MATCHES_PER_PAGE = 5;

interface Match {
  id: string;
  result: MatchResult;
  playedAt: string;
  opponent: { id: string; userId: string; nickname: string };
}

interface Profile {
  id: string;
  userId: string;
  nickname: string;
  xp: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: string;
}

interface ProfileResponse {
  player: Profile;
  matches: Match[];
  total: number;
  page: number;
  limit: number;
}

interface PlayerModalProps {
  playerId: string;
  /** Read off the page's own winners fetch, so opening the card costs no second request. */
  badgeRank?: number;
  /** Offered only where a challenge can be sent; the ranking table has no way to send one. */
  onChallenge?: (userId: string) => void;
  onClose: () => void;
}

/** Every clickable player on the site opens this same card, so the table and the scoreboard cannot drift apart. */
export function PlayerModal({
  playerId,
  badgeRank,
  onChallenge,
  onClose,
}: PlayerModalProps) {
  const [page, setPage] = useState(1);
  // Answers carry the player and page they belong to, so a stale one reads as loading.
  const [loaded, setLoaded] = useState<{
    key: string;
    profile: ProfileResponse;
  } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const { play } = useSound();

  const key = `${playerId}:${page}`;

  useEffect(() => {
    let live = true;

    api
      .get<ProfileResponse>(
        `/players/${playerId}/profile?page=${page}&limit=${MATCHES_PER_PAGE}`
      )
      .then((res) => {
        if (live) setLoaded({ key: `${playerId}:${page}`, profile: res });
      })
      .catch(() => {
        if (live) setFailedKey(`${playerId}:${page}`);
      });

    return () => {
      live = false;
    };
  }, [playerId, page]);

  // The header and stats are the same on every page, so only the rows swap out underneath.
  const known = loaded?.profile.player.id === playerId ? loaded.profile : null;
  const current = loaded?.key === key ? loaded.profile : null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    // Locked only for as long as the card is up; the page behind it scrolls again after.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    closeButton.current?.focus();

    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    // The backdrop is the second way out, so it is a target rather than decoration.
    <div
      className={ styles.overlay }
      onClick={ () => {
        play("makeMove");
        onClose();
      } }
      role="presentation"
    >
      <div
        className={ styles.box }
        role="dialog"
        aria-modal="true"
        aria-label={ known?.player.nickname ?? m.player_modal_title() }
        onClick={ (event) => event.stopPropagation() }
      >
        <Button
          ref={ closeButton }
          type="button"
          className={ styles.close }
          onClick={ onClose }
          aria-label={ m.player_modal_close() }
        >
          <X size={ 18 } />
        </Button>

        { failedKey === key ? (
          <p className={ styles.error }>{ m.player_modal_error() }</p>
        ) : known ? (
          <ProfileBody
            profile={ known }
            matches={ current?.matches ?? null }
            badgeRank={ badgeRank }
            onChallenge={ onChallenge }
            page={ page }
            onPageChange={ setPage }
          />
        ) : (
          <SkeletonBody />
        ) }
      </div>
    </div>
  );
}

function ProfileBody({
  profile,
  matches,
  badgeRank,
  onChallenge,
  page,
  onPageChange,
}: {
  profile: ProfileResponse;
  /** Null while the page is on its way; the header above stays put. */
  matches: Match[] | null;
  badgeRank?: number;
  onChallenge?: (userId: string) => void;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const { player, total } = profile;
  const games = player.wins + player.losses + player.draws;
  const winPct = games > 0 ? Math.round((player.wins / games) * 100) : 0;
  const totalPages = Math.max(1, Math.ceil(total / profile.limit));

  // The ranking table already spells W/L/D in both languages, so the history reuses it.
  const resultLabel: Record<MatchResult, string> = {
    win: m.ranking_w_suffix(),
    loss: m.ranking_l_suffix(),
    draw: m.ranking_d_suffix(),
  };

  return (
    <>
      <header className={ styles.head }>
        <span className={ styles.nickRow }>
          <h2 className={ styles.nick }>{ player.nickname }</h2>
          { badgeRank && <ChampionshipBadge rank={ badgeRank } /> }
        </span>
        <span className={ styles.since }>
          { m.player_modal_since({ date: formatDate(player.createdAt) }) }
        </span>
      </header>

      { onChallenge && (
        <Button
          className={ `btn ${styles.challenge}` }
          onClick={ () => onChallenge(player.userId) }
        >
          <Swords size={ 17 } />
          { m.player_modal_challenge() }
        </Button>
      ) }

      <div className={ styles.tiles }>
        <Tile label={ m.home_stat_xp() } value={ formatNumber(player.xp) } />
        <Tile
          label={ m.home_stat_wins() }
          value={ player.wins }
          tone={ styles.wins }
        />
        <Tile
          label={ m.home_stat_losses() }
          value={ player.losses }
          tone={ styles.losses }
        />
        <Tile label={ m.home_stat_draws() } value={ player.draws } />
      </div>

      <p className={ styles.pct }>{ m.ranking_win_pct({ pct: winPct }) }</p>

      <h3 className={ styles.recent }>{ m.player_modal_recent() }</h3>

      { !matches ? (
        <div className={ styles.rows } aria-busy="true">
          { Array.from({ length: MATCHES_PER_PAGE }).map((_, i) => (
            <span key={ i } className={ styles.skeletonRow } />
          )) }
        </div>
      ) : matches.length === 0 ? (
        <p className={ styles.empty }>{ m.player_modal_no_matches() }</p>
      ) : (
        <ul className={ styles.matches }>
          { matches.map((match) => (
            <li key={ match.id } className={ styles.match }>
              <span className={ `${styles.pill} ${styles[match.result]}` }>
                { resultLabel[match.result] }
              </span>
              <span className={ styles.opponent }>
                <span className={ styles.vs }>{ m.player_modal_vs() }</span>{ " " }
                { match.opponent.nickname }
              </span>
              <span className={ styles.date }>
                { formatDate(match.playedAt) }
              </span>
            </li>
          )) }
        </ul>
      ) }

      { totalPages > 1 && (
        // Arrows only: the card is too narrow for "previous" and "next" spelled out.
        <div className={ styles.pagination }>
          <Button
            className={ `btn ghost ${styles.pager}` }
            onClick={ () => onPageChange(page - 1) }
            disabled={ page === 1 }
            aria-label={ m.ranking_prev() }
          >
            <ChevronLeft size={ 18 } />
          </Button>
          <span className={ styles.pageInfo }>
            { page } / { totalPages }
          </span>
          <Button
            className={ `btn ghost ${styles.pager}` }
            onClick={ () => onPageChange(page + 1) }
            disabled={ page === totalPages }
            aria-label={ m.ranking_next() }
          >
            <ChevronRight size={ 18 } />
          </Button>
        </div>
      ) }
    </>
  );
}

function SkeletonBody() {
  return (
    <div className={ styles.loading } aria-busy="true">
      <span className={ styles.skeletonLine } />
      <div className={ styles.tiles }>
        { Array.from({ length: 4 }).map((_, i) => (
          <span key={ i } className={ `${styles.tile} ${styles.skeletonTile}` } />
        )) }
      </div>
      <div className={ styles.rows }>
        { Array.from({ length: MATCHES_PER_PAGE }).map((_, i) => (
          <span key={ i } className={ styles.skeletonRow } />
        )) }
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <div className={ styles.tile }>
      <span className={ `${styles.tileValue} ${tone ?? ""}` }>{ value }</span>
      <span className={ styles.tileLabel }>{ label }</span>
    </div>
  );
}
