import { m } from "../../../paraglide/messages.js";
import styles from "./match-clock.module.css";

/** The game is drawn when this runs out, so the last stretch is the one worth shouting about. */
const AMBER_MS = 30_000;
const RED_MS = 10_000;

interface MatchClockProps {
  timeLeftMs: number;
}

/** Labelled, because the board already carries a bare seconds counter for the turn. */
export function MatchClock({ timeLeftMs }: MatchClockProps) {
  const total = Math.max(0, Math.ceil(timeLeftMs / 1000));
  const urgency =
    timeLeftMs <= RED_MS
      ? styles.red
      : timeLeftMs <= AMBER_MS
        ? styles.amber
        : "";

  return (
    <div className={ `${styles.clock} ${urgency}` } role="timer">
      <span className={ styles.label }>{ m.play_clock_label() }</span>
      <span className={ styles.digits }>
        { Math.floor(total / 60) }:{ String(total % 60).padStart(2, "0") }
      </span>
    </div>
  );
}
