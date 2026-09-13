type Mark = "X" | "O";

export interface GameSnapshot {
  roomId: string;
  board: (Mark | null)[];
  currentTurn: Mark;
  status: "playing" | "finished" | "starting";
  result?: Mark | "draw" | null;
}

export type GameCue =
  | { kind: "opponentFound"; }
  /** Fires for a timeout handover too, which a board diff alone would not show. */
  | { kind: "changingTurn"; }
  | { kind: "makeMove"; mark: Mark; };

/** Read off the broadcast, not local intent, so both players derive the same sequence. */
export class GameCues {
  private announcedRoom: string | null;
  private lastBoard: (Mark | null)[] | null;
  private lastTurn: { roomId: string; turn: Mark; } | null = null;

  constructor(restored?: { roomId: string; board: (Mark | null)[]; }) {
    this.announcedRoom = restored?.roomId ?? null;
    this.lastBoard = restored ? restored.board : null;
  }

  read(data: GameSnapshot): GameCue[] {
    const cues: GameCue[] = [];
    const previousBoard = this.lastBoard;

    // A turn-timeout tick leaves the board byte-identical, which is what keeps the
    // move cue off the clock.
    if (previousBoard && previousBoard.join(",") !== data.board.join(",")) {
      // The placement is the cell occupied now and not before: any eviction went to empty.
      const landed = data.board.findIndex(
        (cell, i) => cell !== null && cell !== previousBoard[i]
      );
      cues.push({ kind: "makeMove", mark: data.board[landed] ?? data.currentTurn });
    }
    this.lastBoard = data.board;

    const previousTurn = this.lastTurn;
    this.lastTurn = { roomId: data.roomId, turn: data.currentTurn };
    if (
      previousTurn?.roomId === data.roomId &&
      previousTurn.turn !== data.currentTurn &&
      data.status === "playing"
    ) {
      cues.push({ kind: "changingTurn" });
    }

    if (!data.result && this.announcedRoom !== data.roomId) {
      this.announcedRoom = data.roomId;
      cues.push({ kind: "opponentFound" });
    }

    return cues;
  }
}
