import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { formatClock } from "../../../lib/format";
import styles from "./wait-timer.module.css";

interface WaitTimerProps {
  /** Counts down to this epoch. Pass `since` instead to count up from one. */
  until?: number;
  since?: number;
}

export function WaitTimer({ until, since }: WaitTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // A countdown reads its first second as whole, a stopwatch as already spent.
  const seconds =
    until !== undefined
      ? Math.ceil(Math.max(0, until - now) / 1000)
      : Math.floor(Math.max(0, now - (since ?? now)) / 1000);

  return (
    <span className={styles.timer} role="timer">
      <Timer size={13} />
      {formatClock(seconds)}
    </span>
  );
}
