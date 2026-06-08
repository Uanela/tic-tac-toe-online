import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import styles from "./ranking-page.module.css";

interface PlayerRow {
  id: string;
  nickname: string;
  xp: number;
  wins: number;
  losses: number;
  draws: number;
}

const LIMIT = 10;

export default function RankingPage() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const totalPages = Math.ceil(total / LIMIT);

  useEffect(() => {
    setLoading(true);
    api
      .get<{ players: PlayerRow[]; total: number }>(
        `/players/ranking?page=${page}&limit=${LIMIT}`
      )
      .then((res) => {
        setPlayers(res.players);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Global Ranking</h1>
        <p>{total} players competing</p>
      </div>

      <div className={styles.table}>
        <div className={styles.thead}>
          <span>#</span>
          <span>Player</span>
          <span>W / L / D</span>
        </div>

        {loading ? (
          <div className={styles.loading}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={styles.skeleton} />
            ))}
          </div>
        ) : (
          players.map((p, i) => {
            const rank = (page - 1) * LIMIT + i + 1;
            const total_games = p.wins + p.losses + p.draws;
            const winPct =
              total_games > 0 ? Math.round((p.wins / total_games) * 100) : 0;

            return (
              <div
                key={p.id}
                className={`${styles.row} ${rank <= 3 ? styles[`top${rank}`] : ""}`}
              >
                <span className={styles.rank}>
                  {rank === 1
                    ? "🥇"
                    : rank === 2
                      ? "🥈"
                      : rank === 3
                        ? "🥉"
                        : rank}
                </span>

                <div className={styles.playerCol}>
                  <span className={styles.nick}>{p.nickname}</span>
                  <span className={styles.xp}>{p.xp.toLocaleString()} xp</span>
                </div>

                <div className={styles.metaCol}>
                  <div className={styles.wld}>
                    <span className={styles.wins}>{p.wins}W</span>
                    <span className={styles.losses}>{p.losses}L</span>
                    <span className={styles.draws}>{p.draws}D</span>
                  </div>
                  <span className={styles.pct}>{winPct}% win</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className="btn ghost"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
          >
            ← Prev
          </button>
          <span className={styles.pageInfo}>
            {page} / {totalPages}
          </span>
          <button
            className="btn ghost"
            onClick={() => setPage((p) => p + 1)}
            disabled={page === totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
