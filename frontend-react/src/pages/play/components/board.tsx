import styles from "./board.module.css";

type Cell = "X" | "O" | null;

interface BoardProps {
  board: Cell[];
  isMyTurn: boolean;
  onCellClick: (index: number) => void;
  poppedCell: number | null;
  /** The cell the cap evicts on the next placement: the current player's oldest mark. */
  doomedCell: number | null;
  winningLine: number[] | null;
}

export function Board({
  board,
  isMyTurn,
  onCellClick,
  poppedCell,
  doomedCell,
  winningLine,
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
            winningLine?.includes(i) ? styles.winning : "",
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
