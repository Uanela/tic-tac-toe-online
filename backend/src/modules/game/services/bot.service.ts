import ticTacToeService, {
  Board,
  Mark,
  MarkOrder,
  WIN_LINES,
} from "./tic-tac-toe.service";

const SEARCH_DEPTH = 6;

class BotService {
  readonly bestMoveChance = 0.7;

  private other(mark: Mark): Mark {
    return mark === "X" ? "O" : "X";
  }

  findWinner(board: Board): Mark | null {
    for (const [a, b, c] of WIN_LINES) {
      if (board[a] && board[a] === board[b] && board[a] === board[c])
        return board[a] as Mark;
    }
    return null;
  }

  availableMoves(board: Board): number[] {
    const moves: number[] = [];
    for (let i = 0; i < board.length; i++) if (board[i] === null) moves.push(i);
    return moves;
  }

  chooseMove(board: Board, mark: Mark, placed: MarkOrder): number {
    const moves = this.availableMoves(board);
    if (moves.length === 0) return -1;

    const scores = moves.map((index) => {
      const [nextBoard, nextPlaced] = this.play(board, placed, index, mark);
      return {
        index,
        score: this.scoreMove(
          nextBoard,
          nextPlaced,
          this.other(mark),
          mark,
          SEARCH_DEPTH - 1
        ),
      };
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

  private play(
    board: Board,
    placed: MarkOrder,
    index: number,
    mark: Mark
  ): [Board, MarkOrder] {
    // Mirrors the live rule via the service, so there is one definition of which mark leaves.
    const victim = ticTacToeService.nextVictim(board, placed[mark], mark);

    const next = [...board];
    next[index] = mark;

    const order = [...placed[mark], index];
    if (victim !== null) {
      order.splice(order.indexOf(victim), 1);
      next[victim] = null;
    }

    return [next, { ...placed, [mark]: order }];
  }

  private scoreMove(
    board: Board,
    placed: MarkOrder,
    turn: Mark,
    bot: Mark,
    depth: number
  ): number {
    const result = this.findWinner(board);
    if (result === bot) return 1;
    if (result !== null) return -1;
    if (depth <= 0) return this.evaluate(board, bot);

    const scores = this.availableMoves(board).map((index) => {
      const [nextBoard, nextPlaced] = this.play(board, placed, index, turn);
      return this.scoreMove(
        nextBoard,
        nextPlaced,
        this.other(turn),
        bot,
        depth - 1
      );
    });

    return turn === bot ? Math.max(...scores) : Math.min(...scores);
  }

  // The mark cap means play never runs out of cells, so the search bottoms out on
  // depth instead of a terminal draw. Scoring that horizon as a flat 0 would tie every
  // undecided move and leave bestMoveChance nothing to prefer, so lines worth one more
  // mark decide it. A win is 1, so the heuristic is kept inside ±1.
  private evaluate(board: Board, bot: Mark): number {
    let score = 0;

    for (const [a, b, c] of WIN_LINES) {
      const line = [board[a], board[b], board[c]];
      const mine = line.filter((cell) => cell === bot).length;
      const theirs = line.filter((cell) => cell === this.other(bot)).length;

      if (mine > 0 && theirs > 0) continue;
      if (mine === 2) score += 1;
      else if (theirs === 2) score -= 1;
    }

    return score / 10;
  }
}

const botService = new BotService();

export default botService;
