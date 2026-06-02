import { useEffect, useState } from "react";
import styles from "./invite-modal.module.css";

interface InviteModalProps {
  fromNickname: string;
  expiresAt: number;
  onAccept: () => void;
  onDecline: () => void;
}

export function InviteModal({
  fromNickname,
  expiresAt,
  onAccept,
  onDecline,
}: InviteModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const s = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setSecondsLeft(s);
    }, 500);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div className={styles.overlay}>
      <div className={styles.box}>
        <div className={styles.emoji}>⚔️</div>
        <div className={styles.title}>Challenge!</div>
        <div className={styles.sub}>
          <strong>{fromNickname}</strong> wants to play against you
        </div>
        <div className={styles.timer}>{secondsLeft}s</div>
        <div className={styles.actions}>
          <button className="btn" onClick={onAccept}>
            Accept
          </button>
          <button className="btn ghost" onClick={onDecline}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
