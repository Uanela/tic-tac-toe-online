import assert from "node:assert/strict";
import { test } from "node:test";
import botService from "../bot.service";
import { Board, MarkOrder } from "../tic-tac-toe.service";

const empty = (): Board => Array(9).fill(null);
const order = (X: number[], O: number[]): MarkOrder => ({ X, O });

test("findWinner detects a row, a column and a diagonal", () => {
  assert.equal(botService.findWinner(["X", "X", "X", null, null, null, null, null, null]), "X");
  assert.equal(botService.findWinner(["O", null, null, "O", null, null, "O", null, null]), "O");
  assert.equal(botService.findWinner(["X", null, null, null, "X", null, null, null, "X"]), "X");
});

test("findWinner reports null when no line is complete", () => {
  assert.equal(botService.findWinner(["X", "O", "X", "X", "O", "O", "O", "X", "X"]), null);
  assert.equal(botService.findWinner(empty()), null);
});

test("availableMoves lists only empty cells", () => {
  const board: Board = ["X", null, "O", null, "X", null, null, null, "O"];
  assert.deepEqual(botService.availableMoves(board), [1, 3, 5, 6, 7]);
});

test("chooseMove only ever returns an empty cell", () => {
  const board: Board = ["X", "O", "X", null, "O", null, null, null, "X"];
  const placed = order([0, 2, 8], [1, 4]);
  const legal = botService.availableMoves(board);

  for (let i = 0; i < 200; i++) {
    assert.ok(legal.includes(botService.chooseMove(board, "O", placed)));
  }
});

test("chooseMove takes the best move roughly 70% of the time", () => {
  const board: Board = ["X", "X", null, "O", "O", null, null, null, null];
  const placed = order([0, 1], [3, 4]);
  const winning = 2;
  const runs = 2000;

  let taken = 0;
  for (let i = 0; i < runs; i++) {
    if (botService.chooseMove(board, "X", placed) === winning) taken++;
  }

  const rate = taken / runs;
  assert.ok(
    rate > 0.65 && rate < 0.75,
    `expected the best move about 70% of the time, got ${(rate * 100).toFixed(1)}%`
  );
});

test("chooseMove is free to miss a win it does not consider best", () => {
  const board: Board = ["X", "X", null, "O", "O", null, null, null, null];
  const placed = order([0, 1], [3, 4]);
  const picked = new Set<number>();

  for (let i = 0; i < 2000; i++) picked.add(botService.chooseMove(board, "X", placed));

  assert.ok(picked.has(2), "should sometimes take the win");
  assert.ok(picked.size > 1, "should sometimes play something other than the win");
});

test("chooseMove reports no move when the board is full", () => {
  assert.equal(
    botService.chooseMove(["X", "O", "X", "X", "O", "O", "O", "X", "X"], "X", order([], [])),
    -1
  );
});

test("chooseMove prefers the win that survives the vanishing, not the one it destroys", () => {
  // 0 is doomed, so 8 would complete 0-4-8 then evict the line; 1 completes 1-4-7 and survives.
  const board: Board = ["X", null, "O", "O", "X", "O", null, "X", null];
  const placed = order([0, 4, 7], [2, 3, 5]);
  const realWin = 1;
  const runs = 2000;

  let taken = 0;
  for (let i = 0; i < runs; i++) {
    if (botService.chooseMove(board, "X", placed) === realWin) taken++;
  }

  const rate = taken / runs;
  assert.ok(
    rate > 0.65,
    `expected the real win about 70% of the time, got ${(rate * 100).toFixed(1)}%`
  );
});
