import type { GameState } from "../play.page";
import { formatNumber } from "../../../lib/format";
import { m } from "../../../paraglide/messages.js";
import { ChampionshipBadge } from "../../../components/championship-badge";
import { useChampionshipWinners } from "../../../hooks/use-championship-winners";
import styles from "./scoreboard.module.css";

export function Scoreboard({
  data: { playerX, playerO, currentTurn },
}: {
  data: GameState;
}) {
  const badgeRanks = useChampionshipWinners();

  return (
    <div className={styles.root}>
      <div
        className={`${styles.card} ${styles.x} ${currentTurn === "X" ? styles.active : ""}`}
      >
        <span className={styles.mark}>X</span>
        <span className={styles.nameRow}>
          <span className={styles.name}>{playerX.nickname}</span>
          {badgeRanks[playerX.id] && (
            <ChampionshipBadge rank={badgeRanks[playerX.id]} />
          )}
        </span>
        <span className={styles.name}>
          {m.xp_lower({ xp: formatNumber(playerX.xp) })}
        </span>
        {currentTurn === "X" && <span className={styles.turnDot} />}
      </div>

      <div className={styles.vs}>vs</div>

      <div
        className={`${styles.card} ${styles.o} ${currentTurn === "O" ? styles.active : ""}`}
      >
        <span className={styles.mark}>O</span>
        <span className={styles.nameRow}>
          <span className={styles.name}>{playerO.nickname}</span>
          {badgeRanks[playerO.id] && (
            <ChampionshipBadge rank={badgeRanks[playerO.id]} />
          )}
        </span>
        <span className={styles.name}>
          {m.xp_lower({ xp: formatNumber(playerO.xp) })}
        </span>
        {currentTurn === "O" && <span className={styles.turnDot} />}
      </div>
    </div>
  );
}
