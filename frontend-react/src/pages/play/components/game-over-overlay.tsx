import type { ReactNode } from "react";
import { DoorOpen, RotateCcw, UserPlus } from "lucide-react";
import { Button } from "../../../components/button";
import { formatNumber } from "../../../lib/format";
import { m } from "../../../paraglide/messages.js";
import styles from "./game-over-overlay.module.css";

interface GameOverOverlayProps {
  icon: ReactNode;
  title: string;
  sub: string;
  titleColor?: string;
  xpGained?: number;
  canRematch?: boolean;
  onRematch: () => void;
  onNewOpponent: () => void;
  onContinue: () => void;
}

export function GameOverOverlay({
  icon,
  title,
  sub,
  titleColor,
  xpGained,
  canRematch = true,
  onRematch,
  onNewOpponent,
  onContinue,
}: GameOverOverlayProps) {
  return (
    <div className={styles.overlay}>
      <div className={styles.box}>
        <div className={styles.icon}>{icon}</div>
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
        <div className={styles.menu}>
          {canRematch && (
            <Button className="btn" onClick={onRematch}>
              <RotateCcw size={17} />
              {m.gameover_rematch()}
            </Button>
          )}
          <Button className="btn ghost" onClick={onNewOpponent}>
            <UserPlus size={17} />
            {m.gameover_new_opponent()}
          </Button>
          <Button className="btn ghost" onClick={onContinue}>
            <DoorOpen size={17} />
            {m.gameover_continue()}
          </Button>
        </div>
      </div>
    </div>
  );
}
