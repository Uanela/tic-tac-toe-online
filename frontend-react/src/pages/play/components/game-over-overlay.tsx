import styles from "./game-over-overlay.module.css";

interface GameOverOverlayProps {
  emoji: string;
  title: string;
  sub: string;
  titleColor?: string;
  xpGained?: number;
  onPlayAgain: (type?: "invite") => void;
}

export function GameOverOverlay({
  emoji,
  title,
  sub,
  titleColor,
  xpGained,
  onPlayAgain,
}: GameOverOverlayProps) {
  return (
    <div className={styles.overlay}>
      <div className={styles.box}>
        <div className={styles.emoji}>{emoji}</div>
        <div
          className={styles.title}
          style={titleColor ? { color: titleColor } : {}}
        >
          {title}
        </div>
        {sub && <div className={styles.sub}>{sub}</div>}
        {xpGained !== undefined && (
          <div className={styles.xp}>+{xpGained} XP</div>
        )}
        <button className="btn" onClick={() => onPlayAgain("invite")}>
          Play Again
        </button>
        <button className="btn" onClick={() => onPlayAgain()}>
          Continue
        </button>
      </div>
    </div>
  );
}
