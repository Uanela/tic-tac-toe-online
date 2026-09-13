import { useEffect, useState } from "react";
import { m } from "../paraglide/messages.js";
import styles from "./championship-countdown.module.css";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Time left in the championship week, ticking down to the close-out. Days are
 * only worth showing while there are any; the last stretch reads better in hours.
 */
export function ChampionshipCountdown({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  const target = new Date(endsAt).getTime();

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), SECOND_MS);
    return () => clearInterval(interval);
  }, []);

  const left = Math.max(0, target - now);

  const label =
    left >= DAY_MS
      ? m.championship_countdown_dh({
          days: Math.floor(left / DAY_MS),
          hours: Math.floor((left % DAY_MS) / HOUR_MS),
        })
      : m.championship_countdown_hms({
          hours: Math.floor(left / HOUR_MS),
          minutes: Math.floor((left % HOUR_MS) / MINUTE_MS),
          seconds: Math.floor((left % MINUTE_MS) / SECOND_MS),
        });

  return (
    <span className={styles.countdown}>
      {m.championship_ends_in()} {label}
    </span>
  );
}
