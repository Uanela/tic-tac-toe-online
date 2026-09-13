import styles from "./board.module.css";

type Cell = "X" | "O" | null;

interface BoardProps {
  board: Cell[];
  isMyTurn: boolean;
  onCellClick: (index: number) => void;
  poppedCell: number | null;
  /** The mark the cap will evict on the next placement — the current player's oldest. */
  doomedCell: number | null;
}

export function Board({
  board,
  isMyTurn,
  onCellClick,
  poppedCell,
  doomedCell,
}: BoardProps) {
  return (
    <div className={styles.board}>
      {board.map((cell, i) => (
        <button
          key={i}
          className={[
            styles.cell,
            cell ? styles[cell.toLowerCase() as "x" | "o"] : "",
            !cell && isMyTurn ? styles.hoverable : "",
            poppedCell === i ? styles.pop : "",
            doomedCell === i ? styles.doomed : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onCellClick(i)}
          disabled={!!cell || !isMyTurn}
        >
          {cell}
        </button>
      ))}
    </div>
  );
}
