import { formatNumber } from "../../../lib/format";
import { m } from "../../../paraglide/messages.js";
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
          <div className={styles.xp}>
            {m.gameover_xp({ xp: formatNumber(xpGained) })}
          </div>
        )}
        <button className="btn" onClick={() => onPlayAgain("invite")}>
          {m.gameover_play_again()}
        </button>
        <button className="btn" onClick={() => onPlayAgain()}>
          {m.gameover_continue()}
        </button>
      </div>
    </div>
  );
}
