import { Board, Mark, WIN_LINES } from "./tic-tac-toe.service";

class BotService {
  readonly bestMoveChance = 0.7;

  private other(mark: Mark): Mark {
    return mark === "X" ? "O" : "X";
  }

  findWinner(board: Board): Mark | "draw" | null {
    for (const [a, b, c] of WIN_LINES) {
      if (board[a] && board[a] === board[b] && board[a] === board[c])
        return board[a] as Mark;
    }
    return board.every((cell) => cell !== null) ? "draw" : null;
  }

  availableMoves(board: Board): number[] {
    const moves: number[] = [];
    for (let i = 0; i < board.length; i++) if (board[i] === null) moves.push(i);
    return moves;
  }

  chooseMove(board: Board, mark: Mark): number {
    const moves = this.availableMoves(board);
    if (moves.length === 0) return -1;

    const scores = moves.map((index) => {
      const next = [...board];
      next[index] = mark;
      return { index, score: this.scoreMove(next, this.other(mark), mark) };
    });

    const bestScore = Math.max(...scores.map((move) => move.score));
    const best = scores
      .filter((move) => move.score === bestScore)
      .map((move) => move.index);
    const others = moves.filter((index) => !best.includes(index));
    const pool =
      others.length === 0 || Math.random() < this.bestMoveChance ? best : others;

    return pool[Math.floor(Math.random() * pool.length)];
  }

  private scoreMove(board: Board, turn: Mark, bot: Mark): number {
    const result = this.findWinner(board);
    if (result === bot) return 1;
    if (result === "draw") return 0;
    if (result !== null) return -1;

    const scores = this.availableMoves(board).map((index) => {
      const next = [...board];
      next[index] = turn;
      return this.scoreMove(next, this.other(turn), bot);
    });

    return turn === bot ? Math.max(...scores) : Math.min(...scores);
  }
}

const botService = new BotService();

export default botService;
