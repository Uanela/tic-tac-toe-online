import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../utils/contexts/auth.context";
import { api } from "../lib/api";
import { formatNumber } from "../lib/format";
import { m } from "../paraglide/messages.js";
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
      .get<{ players: PlayerRow[]; }>("/players/ranking?page=1&limit=5")
      .then((res) => setTop(res.players))
      .catch(() => { });
  }, []);

  return (
    <div className={ styles.page }>
      <section className={ styles.hero }>
        <div className={ styles.badge }>{ m.home_badge() }</div>
        <OnlinePlayersCount />
        <h1 className={ styles.title }>
          <span className={ styles.xWord }>X</span> vs{ " " }
          <span className={ styles.oWord }>O</span>
        </h1>
        <p className={ styles.sub }>{ m.home_tagline() }</p>
        <div className={ styles.cta }>
          { user ? (
            <Link to="/play" className="btn">
              { m.home_cta_play() }
            </Link>
          ) : (
            <>
              <Link to="/auth/signup" className="btn">
                { m.home_cta_play_now() }
              </Link>
              <Link to="/auth/login" className="btn ghost">
                { m.home_cta_login() }
              </Link>
            </>
          ) }
        </div>
        { player && (
          <div className={ styles.statsBar }>
            <Stat
              label={ m.home_stat_xp() }
              value={ formatNumber(player.xp) }
              color="var(--accent)"
            />
            <Stat
              label={ m.home_stat_wins() }
              value={ formatNumber(player.wins) }
              color="var(--success)"
            />
            <Stat
              label={ m.home_stat_losses() }
              value={ formatNumber(player.losses) }
              color="var(--error)"
            />
            <Stat
              label={ m.home_stat_draws() }
              value={ formatNumber(player.draws) }
              color="var(--muted)"
            />
          </div>
        ) }
      </section>

      <section className={ styles.ranking }>
        <div className={ styles.rankingHeader }>
          <h2>{ m.home_top_title() }</h2>
          <Link to="/ranking" className={styles.seeAll}>
            { m.home_top_see_all() }
          </Link>
        </div>
        <div className={ styles.rankList }>
          { top.map((p, i) => (
            <div key={ p.id } className={ styles.rankRow }>
              <span className={ styles.rankPos }>{ i + 1 }</span>
              <span className={ styles.rankNick }>{ p.nickname }</span>
              <div className={ styles.rankMeta }>
                <span className={ styles.rankXp }>
                  { m.xp_lower({ xp: formatNumber(p.xp) }) }
                </span>
                <span className={ styles.rankRecord }>
                  { m.home_top_record({
                    wins: p.wins,
                    losses: p.losses,
                    draws: p.draws,
                  }) }
                </span>
              </div>
            </div>
          )) }
          { top.length === 0 && (
            <p className={ styles.empty }>{ m.home_top_empty() }</p>
          ) }
        </div>
      </section>

      <section className={ styles.features }>
        <Feature
          icon="⚡"
          title={ m.home_feature_matchmaking_title() }
          desc={ m.home_feature_matchmaking_desc() }
        />
        <Feature
          icon="🏆"
          title={ m.home_feature_ranking_title() }
          desc={ m.home_feature_ranking_desc() }
        />
        <Feature
          icon="🔒"
          title={ m.home_feature_auth_title() }
          desc={ m.home_feature_auth_desc() }
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
  value: string;
  color: string;
}) {
  return (
    <div className={ styles.stat }>
      <span className={ styles.statVal } style={ { color } }>
        { value }
      </span>
      <span className={ styles.statLabel }>{ label }</span>
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
    <div className={ styles.feature }>
      <span className={ styles.featureIcon }>{ icon }</span>
      <h3>{ title }</h3>
      <p>{ desc }</p>
    </div>
  );
}
