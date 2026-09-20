import { useState } from "react";
import type { GameState } from "../play.page";
import { formatNumber } from "../../../lib/format";
import { m } from "../../../paraglide/messages.js";
import { Button } from "../../../components/button";
import { ChampionshipBadge } from "../../../components/championship-badge";
import { PlayerModal } from "../../../components/player-modal";
import { useChampionshipWinners } from "../../../hooks/use-championship-winners";
import styles from "./scoreboard.module.css";

export function Scoreboard({
  data: { playerX, playerO, currentTurn },
}: {
  data: GameState;
}) {
  const badgeRanks = useChampionshipWinners();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className={styles.root}>
      <PlayerCard
        player={playerX}
        mark="X"
        active={currentTurn === "X"}
        badgeRank={badgeRanks[playerX.id]}
        onOpen={() => setOpenId(playerX.id)}
      />

      <div className={styles.vs}>vs</div>

      <PlayerCard
        player={playerO}
        mark="O"
        active={currentTurn === "O"}
        badgeRank={badgeRanks[playerO.id]}
        onOpen={() => setOpenId(playerO.id)}
      />

      {openId && (
        <PlayerModal
          playerId={openId}
          badgeRank={badgeRanks[openId]}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function PlayerCard({
  player,
  mark,
  active,
  badgeRank,
  onOpen,
}: {
  player: { id: string; nickname: string; xp: number };
  mark: "X" | "O";
  active: boolean;
  badgeRank?: number;
  onOpen: () => void;
}) {
  return (
    <Button
      type="button"
      className={`${styles.card} ${mark === "X" ? styles.x : styles.o} ${active ? styles.active : ""}`}
      onClick={onOpen}
      title={m.player_modal_title()}
    >
      <span className={styles.mark}>{mark}</span>
      <span className={styles.nameRow}>
        <span className={styles.name}>{player.nickname}</span>
        {badgeRank && <ChampionshipBadge rank={badgeRank} />}
      </span>
      <span className={styles.name}>
        {m.xp_lower({ xp: formatNumber(player.xp) })}
      </span>
      {active && <span className={styles.turnDot} />}
    </Button>
  );
}
