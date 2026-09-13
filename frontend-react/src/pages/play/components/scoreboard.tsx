import type { GameState } from "../play.page";
import { formatNumber } from "../../../lib/format";
import { m } from "../../../paraglide/messages.js";
import styles from "./scoreboard.module.css";

export function Scoreboard({
  data: { playerX, playerO, currentTurn },
}: {
  data: GameState;
}) {
  return (
    <div className={styles.root}>
      <div
        className={`${styles.card} ${styles.x} ${currentTurn === "X" ? styles.active : ""}`}
      >
        <span className={styles.mark}>X</span>
        <span className={styles.name}>{playerX.nickname}</span>
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
        <span className={styles.name}>{playerO.nickname}</span>
        <span className={styles.name}>
          {m.xp_lower({ xp: formatNumber(playerO.xp) })}
        </span>
        {currentTurn === "O" && <span className={styles.turnDot} />}
      </div>
    </div>
  );
}
