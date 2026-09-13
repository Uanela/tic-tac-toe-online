import { Crown } from "lucide-react";
import { BADGE_COLORS } from "../lib/championship";
import { m } from "../paraglide/messages.js";
import styles from "./championship-badge.module.css";

/**
 * The crown last week's top four carry into this week. Rank picks the colour;
 * anything outside the top four renders nothing at all.
 */
export function ChampionshipBadge({ rank }: { rank: number }) {
  const color = BADGE_COLORS[rank];
  if (!color) return null;

  const label = m.championship_badge({ rank });

  return (
    <span
      className={styles.badge}
      style={{ color }}
      title={label}
      aria-label={label}
      role="img"
    >
      <Crown size={12} fill="currentColor" />
    </span>
  );
}
