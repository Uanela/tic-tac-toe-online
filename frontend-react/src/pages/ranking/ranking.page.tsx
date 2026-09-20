import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Medal } from "lucide-react";
import { api } from "../../lib/api";
import { formatNumber } from "../../lib/format";
import { m } from "../../paraglide/messages.js";
import { Button } from "../../components/button";
import { Tabs } from "../../components/tabs";
import { ChampionshipBadge } from "../../components/championship-badge";
import { ChampionshipCountdown } from "../../components/championship-countdown";
import { PlayerModal } from "../../components/player-modal";
import { useChampionshipWinners } from "../../hooks/use-championship-winners";
import { BADGE_COLORS } from "../../lib/championship";
import type { ChampionshipPeriod, Standing } from "../../lib/championship";
import styles from "./ranking-page.module.css";

const LIMIT = 10;
const MEDAL_RANKS = 3;

type TabId = "weekly" | "all";

interface Row {
  key: string;
  playerId: string;
  nickname: string;
  xp: number;
  wins: number;
  losses: number;
  draws: number;
}

interface AllTimePlayer {
  id: string;
  nickname: string;
  xp: number;
  wins: number;
  losses: number;
  draws: number;
}

interface AllTimeResponse {
  players: AllTimePlayer[];
  total: number;
}

interface ChampionshipResponse {
  players: Standing[];
  total: number;
  period: ChampionshipPeriod;
}

export default function RankingPage() {
  const [tab, setTab] = useState<TabId>("weekly");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [period, setPeriod] = useState<ChampionshipPeriod | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const totalPages = Math.ceil(total / LIMIT);
  const badgeRanks = useChampionshipWinners();
  const navigate = useNavigate();
  const challenge = (userId: string) => navigate(`/play?challenge=${userId}`);

  // Read inside the render, not at module scope: the labels follow the locale.
  const tabs = [
    { id: "weekly", label: m.ranking_tab_weekly() },
    { id: "all", label: m.ranking_tab_all() },
  ];

  useEffect(() => {
    setLoading(true);

    // The two tabs answer with different rows, so each is flattened to the one
    // shape the table renders. A player's own id is what the badges are keyed
    // by, which for the all-time tab is simply the row's id.
    const request: Promise<{ rows: Row[]; total: number }> =
      tab === "weekly"
        ? api
            .get<ChampionshipResponse>(
              `/championship/ranking?page=${page}&limit=${LIMIT}`
            )
            .then((res) => {
              setPeriod(res.period);

              return {
                rows: res.players.map((standing) => ({
                  key: standing.id,
                  playerId: standing.playerId,
                  nickname: standing.nickname,
                  xp: standing.xp,
                  wins: standing.wins,
                  losses: standing.losses,
                  draws: standing.draws,
                })),
                total: res.total,
              };
            })
        : api
            .get<AllTimeResponse>(`/players/ranking?page=${page}&limit=${LIMIT}`)
            .then((res) => ({
              rows: res.players.map((player) => ({
                key: player.id,
                playerId: player.id,
                nickname: player.nickname,
                xp: player.xp,
                wins: player.wins,
                losses: player.losses,
                draws: player.draws,
              })),
              total: res.total,
            }));

    request
      .then((res) => {
        setRows(res.rows);
        setTotal(res.total);
      })
      .catch(() => {
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [tab, page]);

  const changeTab = (id: string) => {
    setTab(id as TabId);
    setPage(1);
  };

  return (
    <div className={ styles.page }>
      <div className={ styles.header }>
        <h1>{ m.ranking_title() }</h1>
        <p>
          { tab === "weekly"
            ? m.championship_competing({ total: formatNumber(total) })
            : m.ranking_competing({ total: formatNumber(total) }) }
        </p>
      </div>

      <div className={ styles.controls }>
        <Tabs tabs={ tabs } active={ tab } onChange={ changeTab } />
        { tab === "weekly" && period && (
          <ChampionshipCountdown endsAt={ period.endedAt } />
        ) }
      </div>

      <div className={ styles.table }>
        <div className={ styles.thead }>
          <span>#</span>
          <span>{ m.ranking_player() }</span>
          <span>{ m.ranking_wld() }</span>
        </div>

        { loading ? (
          <div className={ styles.loading }>
            { Array.from({ length: 8 }).map((_, i) => (
              <div key={ i } className={ styles.skeleton } />
            )) }
          </div>
        ) : rows.length === 0 ? (
          <p className={ styles.empty }>
            { tab === "weekly" ? m.championship_empty() : m.home_top_empty() }
          </p>
        ) : (
          rows.map((p, i) => {
            const rank = (page - 1) * LIMIT + i + 1;
            const games = p.wins + p.losses + p.draws;
            const winPct = games > 0 ? Math.round((p.wins / games) * 100) : 0;
            const badge = badgeRanks[p.playerId];

            return (
              <button
                key={ p.key }
                type="button"
                className={ `${styles.row} ${rank <= 3 ? styles[`top${rank}`] : ""}` }
                onClick={ () => setOpenId(p.playerId) }
                title={ m.player_modal_title() }
              >
                <span className={ styles.rank }>
                  { rank <= MEDAL_RANKS ? (
                    <Medal
                      size={ 16 }
                      color={ BADGE_COLORS[rank] }
                      aria-label={ m.ranking_rank({ rank }) }
                    />
                  ) : (
                    rank
                  ) }
                </span>

                <div className={ styles.playerCol }>
                  <span className={ styles.nickRow }>
                    <span className={ styles.nick }>{ p.nickname }</span>
                    { badge && <ChampionshipBadge rank={ badge } /> }
                  </span>
                  <span className={ styles.xp }>
                    { m.xp_lower({ xp: formatNumber(p.xp) }) }
                  </span>
                </div>

                <div className={ styles.metaCol }>
                  <div className={ styles.wld }>
                    <span className={ styles.wins }>
                      { p.wins }
                      { m.ranking_w_suffix() }
                    </span>
                    <span className={ styles.losses }>
                      { p.losses }
                      { m.ranking_l_suffix() }
                    </span>
                    <span className={ styles.draws }>
                      { p.draws }
                      { m.ranking_d_suffix() }
                    </span>
                  </div>
                  <span className={ styles.pct }>
                    { m.ranking_win_pct({ pct: winPct }) }
                  </span>
                </div>
              </button>
            );
          })
        ) }
      </div>

      { totalPages > 1 && (
        <div className={ styles.pagination }>
          <Button
            className="btn ghost"
            onClick={ () => setPage((p) => p - 1) }
            disabled={ page === 1 }
          >
            { m.ranking_prev() }
          </Button>
          <span className={ styles.pageInfo }>
            { page } / { totalPages }
          </span>
          <Button
            className="btn ghost"
            onClick={ () => setPage((p) => p + 1) }
            disabled={ page === totalPages }
          >
            { m.ranking_next() }
          </Button>
        </div>
      ) }

      { openId && (
        <PlayerModal
          key={ openId }
          playerId={ openId }
          badgeRank={ badgeRanks[openId] }
          onChallenge={ challenge }
          onClose={ () => setOpenId(null) }
        />
      ) }
    </div>
  );
}
