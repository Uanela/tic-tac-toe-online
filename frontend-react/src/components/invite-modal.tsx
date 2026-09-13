import { useEffect, useState } from "react";
import { Swords } from "lucide-react";
import { m } from "../paraglide/messages.js";
import { Button } from "./button";
import { RichText } from "./rich-text";
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
        <div className={styles.icon}>
          <Swords size={40} color="var(--x-color)" />
        </div>
        <div className={styles.title}>{m.invite_title()}</div>
        <div className={styles.sub}>
          <RichText parts={ m.invite_body.parts({ nickname: fromNickname }) } />
        </div>
        <div className={styles.timer}>{secondsLeft}s</div>
        <div className={styles.actions}>
          <Button className="btn" onClick={onAccept}>
            {m.invite_accept()}
          </Button>
          <Button className="btn ghost" onClick={onDecline}>
            {m.invite_decline()}
          </Button>
        </div>
      </div>
    </div>
  );
}
