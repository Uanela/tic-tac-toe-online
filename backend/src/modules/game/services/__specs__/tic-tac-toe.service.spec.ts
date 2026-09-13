import assert from "node:assert/strict";
import { test } from "node:test";
import ticTacToeService, {
  Cell,
  GameRoom,
  Mark,
  SocketPlayer,
} from "../tic-tac-toe.service";

const player = (mark: Mark): SocketPlayer => ({
  userId: `user_${mark}`,
  playerId: `player_${mark}`,
  nickname: mark,
  mark,
  xp: 0,
  isBot: false,
});

const room = (
  roomId: string,
  cells: Cell[],
  placed: { X: number[]; O: number[] },
  currentTurn: Mark
): GameRoom => ({
  id: roomId,
  roomId,
  gameId: `game_${roomId}`,
  players: [player("X"), player("O")],
  board: cells,
  placed,
  currentTurn,
  status: "playing",
  result: null,
  lastMove: null,
  lastUpdate: new Date(),
  startedAt: new Date(),
});

test("a player keeps three marks without losing any", () => {
  const game = room("room_three", [...ticTacToeService.emptyBoard()], { X: [], O: [] }, "X");
  ticTacToeService.setRoom(game.roomId, game);

  ticTacToeService.makeMove(game.roomId, 0, player("X"));
  ticTacToeService.makeMove(game.roomId, 3, player("O"));
  ticTacToeService.makeMove(game.roomId, 1, player("X"));
  ticTacToeService.makeMove(game.roomId, 4, player("O"));
  const state = ticTacToeService.makeMove(game.roomId, 6, player("X"));

  const live = ticTacToeService.getRoom(game.roomId)!;
  assert.deepEqual(live.placed.X, [0, 1, 6]);
  assert.equal(live.board[0], "X");
  assert.equal(live.board[6], "X");
  assert.deepEqual(state.doomed, { X: 0, O: null });
});

test("placing a fourth mark evicts the oldest one", () => {
  // O sits on 3, 5 and 8, which completes no line with any of X's marks, so none of X's
  // three is a blocker and the plain oldest-goes rule stands.
  const game = room("room_evict", [...ticTacToeService.emptyBoard()], { X: [], O: [] }, "X");
  ticTacToeService.setRoom(game.roomId, game);

  ticTacToeService.makeMove(game.roomId, 0, player("X"));
  ticTacToeService.makeMove(game.roomId, 3, player("O"));
  ticTacToeService.makeMove(game.roomId, 1, player("X"));
  ticTacToeService.makeMove(game.roomId, 5, player("O"));
  ticTacToeService.makeMove(game.roomId, 6, player("X"));
  ticTacToeService.makeMove(game.roomId, 8, player("O"));
  ticTacToeService.makeMove(game.roomId, 2, player("X"));

  const live = ticTacToeService.getRoom(game.roomId)!;
  assert.equal(live.board[0], null, "the oldest mark left the board");
  assert.equal(live.board[2], "X", "the new mark stays");
  assert.deepEqual(live.placed.X, [1, 6, 2]);
  assert.deepEqual(live.placed.O, [3, 5, 8], "the opponent's marks are untouched");
});

test("the oldest mark is skipped when it is the third of a line the opponent holds", () => {
  // O holds 4 and 8, so X's 0 in the same diagonal is the one cell O needs. Evicting it
  // would empty that cell and hand O 0-4-8 on the spot, so 1 goes instead.
  const game = room("room_skip", [...ticTacToeService.emptyBoard()], { X: [], O: [] }, "X");
  ticTacToeService.setRoom(game.roomId, game);

  ticTacToeService.makeMove(game.roomId, 0, player("X"));
  ticTacToeService.makeMove(game.roomId, 3, player("O"));
  ticTacToeService.makeMove(game.roomId, 1, player("X"));
  ticTacToeService.makeMove(game.roomId, 4, player("O"));
  ticTacToeService.makeMove(game.roomId, 6, player("X"));
  ticTacToeService.makeMove(game.roomId, 8, player("O"));
  const state = ticTacToeService.makeMove(game.roomId, 2, player("X"));

  const live = ticTacToeService.getRoom(game.roomId)!;
  assert.equal(live.board[0], "X", "the blocker stays put");
  assert.equal(live.board[1], null, "the next oldest went instead");
  assert.equal(live.board[2], "X", "the new mark stays");
  assert.deepEqual(live.placed.X, [0, 6, 2]);
  // The skip is symmetric: X now holds 0+6 and 2+6, so O's 3 and 4 block X lines too and
  // O's own oldest eligible mark is 8.
  assert.equal(state.doomed.O, 8);
});

test("a blocker is evicted anyway when every mark is one", () => {
  // O holds 0, 2 and 4, which makes each of X's marks the third of a line O already owns
  // the other two of. The skip runs out of candidates and the oldest leaves regardless.
  const cells: Cell[] = [...ticTacToeService.emptyBoard()];
  cells[1] = "X";
  cells[6] = "X";
  cells[8] = "X";
  cells[0] = "O";
  cells[2] = "O";
  cells[4] = "O";
  const game = room("room_blockers", cells, { X: [1, 6, 8], O: [0, 2, 4] }, "X");
  ticTacToeService.setRoom(game.roomId, game);

  const state = ticTacToeService.makeMove(game.roomId, 3, player("X"));

  const live = ticTacToeService.getRoom(game.roomId)!;
  assert.equal(live.board[1], null, "the oldest went once the skip ran out of room");
  assert.equal(live.board[3], "X", "the new mark stays");
  assert.deepEqual(live.placed.X, [6, 8, 3]);
  assert.equal(state.doomed.X, 3, "only the new mark is free of a line, so it is next");
});

test("a line completed through the doomed mark does not win", () => {
  // X holds 0, 1 and 4 with only O on 3, 5 and 7, so nothing is blocked and 0 is doomed:
  // playing 2 completes 0-1-2 and then evicts 0, breaking the very line it just made.
  const cells: Cell[] = [...ticTacToeService.emptyBoard()];
  cells[0] = "X";
  cells[1] = "X";
  cells[4] = "X";
  cells[3] = "O";
  cells[5] = "O";
  cells[7] = "O";
  const game = room("room_doomed", cells, { X: [0, 1, 4], O: [3, 5, 7] }, "X");
  ticTacToeService.setRoom(game.roomId, game);

  const state = ticTacToeService.makeMove(game.roomId, 2, player("X"));

  assert.equal(state.board[0], null);
  assert.deepEqual(ticTacToeService.getRoom(game.roomId)!.placed.X, [1, 4, 2]);
  assert.equal(
    ticTacToeService.checkWinner(state.board),
    null,
    "the eviction resolves before the line is judged"
  );
});

test("doomed is null until a player is holding a full hand", () => {
  const game = room("room_doomed_empty", [...ticTacToeService.emptyBoard()], { X: [], O: [] }, "X");
  ticTacToeService.setRoom(game.roomId, game);

  ticTacToeService.makeMove(game.roomId, 0, player("X"));
  const state = ticTacToeService.makeMove(game.roomId, 3, player("O"));

  assert.deepEqual(state.doomed, { X: null, O: null });
});

test("checkWinner never reports a draw", () => {
  assert.equal(
    ticTacToeService.checkWinner(["X", "O", "X", "X", "O", "O", "O", "X", "X"]),
    null
  );
});
