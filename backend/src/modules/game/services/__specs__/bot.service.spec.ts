import assert from "node:assert/strict";
import { test } from "node:test";
import botService from "../bot.service";
import { Board } from "../tic-tac-toe.service";

const empty = (): Board => Array(9).fill(null);

test("findWinner detects a row, a column and a diagonal", () => {
  assert.equal(botService.findWinner(["X", "X", "X", null, null, null, null, null, null]), "X");
  assert.equal(botService.findWinner(["O", null, null, "O", null, null, "O", null, null]), "O");
  assert.equal(botService.findWinner(["X", null, null, null, "X", null, null, null, "X"]), "X");
});

test("findWinner reports a draw on a full board and null while play continues", () => {
  assert.equal(botService.findWinner(["X", "O", "X", "X", "O", "O", "O", "X", "X"]), "draw");
  assert.equal(botService.findWinner(empty()), null);
});

test("availableMoves lists only empty cells", () => {
  const board: Board = ["X", null, "O", null, "X", null, null, null, "O"];
  assert.deepEqual(botService.availableMoves(board), [1, 3, 5, 6, 7]);
});

test("chooseMove only ever returns an empty cell", () => {
  const board: Board = ["X", "O", "X", null, "O", null, null, null, "X"];
  const legal = botService.availableMoves(board);

  for (let i = 0; i < 200; i++) {
    assert.ok(legal.includes(botService.chooseMove(board, "O")));
  }
});

test("chooseMove takes the best move roughly 70% of the time", () => {
  const board: Board = ["X", "X", null, "O", "O", null, null, null, null];
  const winning = 2;
  const runs = 2000;

  let taken = 0;
  for (let i = 0; i < runs; i++) {
    if (botService.chooseMove(board, "X") === winning) taken++;
  }

  const rate = taken / runs;
  assert.ok(
    rate > 0.65 && rate < 0.75,
    `expected the best move about 70% of the time, got ${(rate * 100).toFixed(1)}%`
  );
});

test("chooseMove is free to miss a win it does not consider best", () => {
  const board: Board = ["X", "X", null, "O", "O", null, null, null, null];
  const picked = new Set<number>();

  for (let i = 0; i < 2000; i++) picked.add(botService.chooseMove(board, "X"));

  assert.ok(picked.has(2), "should sometimes take the win");
  assert.ok(picked.size > 1, "should sometimes play something other than the win");
});

test("chooseMove has no move to make on a full board", () => {
  assert.equal(botService.chooseMove(["X", "O", "X", "X", "O", "O", "O", "X", "X"], "X"), -1);
});
