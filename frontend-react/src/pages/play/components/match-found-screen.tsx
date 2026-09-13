import { useEffect, useState } from "react";
import { useSound } from "../../../utils/contexts/sound.context";
import { m } from "../../../paraglide/messages.js";
import styles from "./match-found-screen.module.css";

/**
 * The countdown is the sequence's last three seconds rather than a fixed offset, so
 * a cue that outlasts the floor still lands its final beat on "1" instead of a cut-off.
 */
const MIN_SEQUENCE_MS = 4000;
const MIN_ANIMATION_MS = 1200;
const COUNTDOWN_FROM = 3;
const MATCH_FOUND_DUCK = 0.2;

interface MatchFoundScreenProps {
  me: string;
  opponent: string;
  /** The board is already live behind this card. */
  onDone: () => void;
}

export function MatchFoundScreen({ me, opponent, onDone }: MatchFoundScreenProps) {
  const { duckMusic, unduckMusic, durationMs } = useSound();

  const [remaining, setRemaining] = useState(() =>
    Math.max(MIN_SEQUENCE_MS, durationMs("opponentFound") + MIN_ANIMATION_MS)
  );

  // Tied to this screen, not the page: the loop must not come back to full volume
  // while the card still covers the board.
  useEffect(() => {
    duckMusic("matchFound", MATCH_FOUND_DUCK);
    return () => unduckMusic("matchFound");
  }, [duckMusic, unduckMusic]);

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1000));
    }, 1000);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (remaining === 0) onDone();
  }, [remaining, onDone]);

  const count = Math.ceil(remaining / 1000);

  return (
    <div className={ styles.screen }>
      <div className={ styles.cards }>
        <PlayerCard nickname={ me } tone="me" />
        <span className={ styles.vs }>VS</span>
        <PlayerCard nickname={ opponent } tone="opponent" />
      </div>

      <p className={ styles.countdown }>
        { count >= 1 && count <= COUNTDOWN_FROM
          ? m.match_found_countdown({ seconds: count })
          : m.match_found_title() }
      </p>
    </div>
  );
}

function PlayerCard({ nickname, tone }: { nickname: string; tone: "me" | "opponent"; }) {
  const initial = nickname.slice(0, 1).toUpperCase();

  return (
    <div className={ `${styles.card} ${styles[tone]}` }>
      { nickname ? (
        <div className={ styles.avatar }>{ initial }</div>
      ) : (
        <div className={ `${styles.avatar} ${styles.skeleton}` } />
      ) }

      { nickname ? (
        <span className={ styles.nick }>{ nickname }</span>
      ) : (
        <span className={ styles.skeletonBar } role="status">
          { m.match_found_loading() }
        </span>
      ) }
    </div>
  );
}
