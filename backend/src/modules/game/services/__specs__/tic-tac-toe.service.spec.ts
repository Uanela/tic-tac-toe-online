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
  const game = room("room_evict", [...ticTacToeService.emptyBoard()], { X: [], O: [] }, "X");
  ticTacToeService.setRoom(game.roomId, game);

  ticTacToeService.makeMove(game.roomId, 0, player("X"));
  ticTacToeService.makeMove(game.roomId, 3, player("O"));
  ticTacToeService.makeMove(game.roomId, 1, player("X"));
  ticTacToeService.makeMove(game.roomId, 4, player("O"));
  ticTacToeService.makeMove(game.roomId, 6, player("X"));
  ticTacToeService.makeMove(game.roomId, 8, player("O"));
  ticTacToeService.makeMove(game.roomId, 2, player("X"));

  const live = ticTacToeService.getRoom(game.roomId)!;
  assert.equal(live.board[0], null, "the oldest mark left the board");
  assert.equal(live.board[2], "X", "the new mark stays");
  assert.deepEqual(live.placed.X, [1, 6, 2]);
  assert.deepEqual(live.placed.O, [3, 4, 8], "the opponent's marks are untouched");
});

test("a line completed through the doomed mark does not win", () => {
  // X holds 0, 1 and 4, so 0 is doomed: playing 2 evicts 0 and breaks 0-1-2.
  const cells: Cell[] = [...ticTacToeService.emptyBoard()];
  cells[0] = "X";
  cells[1] = "X";
  cells[4] = "X";
  cells[3] = "O";
  cells[6] = "O";
  cells[8] = "O";
  const game = room("room_doomed", cells, { X: [0, 1, 4], O: [3, 6, 8] }, "X");
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
