import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../utils/contexts/auth.context";
import { api } from "../lib/api";
import styles from "./home-page.module.css";
import OnlinePlayersCount from "./play/components/online-players-count";

interface PlayerRow {
  id: string;
  nickname: string;
  xp: number;
  wins: number;
  losses: number;
  draws: number;
}

export default function HomePage() {
  const { user, player } = useAuth();
  const [top, setTop] = useState<PlayerRow[]>([]);

  useEffect(() => {
    api
      .get<{ players: PlayerRow[] }>("/players/ranking?page=1&limit=5")
      .then((res) => setTop(res.players))
      .catch(() => {});
  }, []);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.badge}>Multiplayer · Real-time</div>
        <OnlinePlayersCount />
        <h1 className={styles.title}>
          <span className={styles.xWord}>X</span> vs{" "}
          <span className={styles.oWord}>O</span>
        </h1>
        <p className={styles.sub}>
          The classic game — now with ranked matchmaking, XP, and global
          leaderboards. Connect, play, climb.
        </p>
        <div className={styles.cta}>
          {user ? (
            <Link to="/play" className="btn">
              Find a match
            </Link>
          ) : (
            <>
              <Link to="/auth/signup" className="btn">
                Play now
              </Link>
              <Link to="/auth/login" className="btn ghost">
                Log in
              </Link>
            </>
          )}
        </div>
        {player && (
          <div className={styles.statsBar}>
            <Stat label="XP" value={player.xp} color="var(--accent)" />
            <Stat label="Wins" value={player.wins} color="var(--success)" />
            <Stat label="Losses" value={player.losses} color="var(--error)" />
            <Stat label="Draws" value={player.draws} color="var(--muted)" />
          </div>
        )}
      </section>

      <section className={styles.ranking}>
        <div className={styles.rankingHeader}>
          <h2>Top Players</h2>
          <Link to="/ranking" className={styles.seeAll}>
            See all →
          </Link>
        </div>
        <div className={styles.rankList}>
          {top.map((p, i) => (
            <div key={p.id} className={styles.rankRow}>
              <span className={styles.rankPos}>{i + 1}</span>
              <span className={styles.rankNick}>{p.nickname}</span>
              <div className={styles.rankMeta}>
                <span className={styles.rankXp}>{p.xp} xp</span>
                <span className={styles.rankRecord}>
                  {p.wins}W · {p.losses}L · {p.draws}D
                </span>
              </div>
            </div>
          ))}
          {top.length === 0 && (
            <p className={styles.empty}>No players yet. Be the first!</p>
          )}
        </div>
      </section>

      <section className={styles.features}>
        <Feature
          icon="⚡"
          title="Instant matchmaking"
          desc="Get paired with a random opponent in seconds."
        />
        <Feature
          icon="🏆"
          title="XP & ranking"
          desc="Win games to earn XP and climb the global leaderboard."
        />
        <Feature
          icon="🔒"
          title="Authenticated play"
          desc="Every game is tracked — your record is yours forever."
        />
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statVal} style={{ color }}>
        {value}
      </span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <div className={styles.feature}>
      <span className={styles.featureIcon}>{icon}</span>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}
