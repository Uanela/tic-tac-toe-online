import { useState } from "react";
import { useAuth } from "../utils/contexts/auth.context";
import pushService from "../lib/push";
import { Button } from "./button";
import { m } from "../paraglide/messages.js";
import styles from "./push-prompt.module.css";

const DISMISSED_KEY = "push-prompt-dismissed";

/** Asked once the player has a result on the board: a browser that has never played
 *  has nothing to be pinged about, and a denied prompt cannot be taken back. */
export function PushPrompt() {
  const { player } = useAuth();
  const [asking, setAsking] = useState(false);

  const hasPlayed = !!player && player.wins + player.losses + player.draws > 0;

  if (
    !hasPlayed ||
    !pushService.configured ||
    Notification.permission !== "default"
  )
    return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
  }

  async function enable() {
    setAsking(true);
    try {
      await pushService.requestPermission();
    } catch (error) {
      console.error("push registration failed", error);
    }

    setAsking(false);
    dismiss();
  }

  return (
    <div className={styles.prompt} role="status">
      <div className={styles.text}>
        <p className={styles.title}>{m.push_prompt_title()}</p>
        <p className={styles.body}>{m.push_prompt_body()}</p>
      </div>
      <div className={styles.actions}>
        <Button className="btn" onClick={enable} disabled={asking}>
          {m.push_prompt_enable()}
        </Button>
        <Button className="btn ghost" onClick={dismiss}>
          {m.push_prompt_later()}
        </Button>
      </div>
    </div>
  );
}

