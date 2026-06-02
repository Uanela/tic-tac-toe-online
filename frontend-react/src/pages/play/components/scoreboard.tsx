import styles from "./scoreboard.module.css";

type Mark = "X" | "O";

interface ScoreboardProps {
  nameX: string;
  nameO: string;
  currentTurn: Mark;
  myMark: Mark | null;
}

export function Scoreboard({ nameX, nameO, currentTurn }: ScoreboardProps) {
  return (
    <div className={styles.root}>
      <div
        className={`${styles.card} ${styles.x} ${currentTurn === "X" ? styles.active : ""}`}
      >
        <span className={styles.mark}>X</span>
        <span className={styles.name}>{nameX}</span>
        {currentTurn === "X" && <span className={styles.turnDot} />}
      </div>

      <div className={styles.vs}>vs</div>

      <div
        className={`${styles.card} ${styles.o} ${currentTurn === "O" ? styles.active : ""}`}
      >
        <span className={styles.mark}>O</span>
        <span className={styles.name}>{nameO}</span>
        {currentTurn === "O" && <span className={styles.turnDot} />}
      </div>
    </div>
  );
}
