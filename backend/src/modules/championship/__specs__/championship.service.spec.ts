import assert from "node:assert/strict";
import { test } from "node:test";
import championshipService from "../championship.service";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Monday 07 September 2026, 00:00 in Maputo — and the Mondays either side of it.
const MONDAY = "2026-09-06T22:00:00.000Z";
const NEXT_MONDAY = "2026-09-13T22:00:00.000Z";
const MONDAY_BEFORE = "2026-08-30T22:00:00.000Z";

/**
 * Reads the clock back through the real timezone database rather than through the
 * service's own arithmetic, so a wrong fixed offset cannot agree with itself.
 */
const maputo = (date: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Maputo",
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );

test("a game midweek lands in the week that opened on Monday", () => {
  const period = championshipService.periodFor(
    new Date("2026-09-09T12:00:00.000Z")
  );

  assert.equal(period.startedAt.toISOString(), MONDAY);
  assert.equal(period.endedAt.toISOString(), NEXT_MONDAY);
});

test("Sunday night in Maputo still belongs to the week that is closing", () => {
  // 23:59 in Maputo, one hour short of the boundary.
  const period = championshipService.periodFor(
    new Date("2026-09-13T21:59:00.000Z")
  );

  assert.equal(period.startedAt.toISOString(), MONDAY);
});

test("the boundary instant opens the next week", () => {
  const period = championshipService.periodFor(new Date(NEXT_MONDAY));

  assert.equal(period.startedAt.toISOString(), NEXT_MONDAY);
  assert.equal(period.endedAt.toISOString(), "2026-09-20T22:00:00.000Z");
});

test("every week is seven days long and opens on Monday at midnight in Maputo", () => {
  for (let day = 0; day < 21; day++) {
    const at = new Date(Date.UTC(2026, 8, 1 + day, 12));

    const period = championshipService.periodFor(at);
    const start = maputo(period.startedAt);

    assert.equal(period.endedAt.getTime() - period.startedAt.getTime(), WEEK_MS);
    assert.equal(start.weekday, "Mon");
    assert.equal(start.hour, "00");
    assert.equal(start.minute, "00");
    assert.equal(start.second, "00");
    // The window has to contain the instant that was asked about.
    assert.ok(period.startedAt <= at && at < period.endedAt);
  }
});

test("the previous week ends exactly where this one starts", () => {
  const period = championshipService.periodFor(
    new Date("2026-09-09T12:00:00.000Z")
  );

  const previous = championshipService.previousPeriod(period);

  assert.equal(previous.endedAt.toISOString(), period.startedAt.toISOString());
  assert.equal(previous.startedAt.toISOString(), MONDAY_BEFORE);
  assert.equal(maputo(previous.startedAt).weekday, "Mon");
});

test("the week awaiting a close-out is the one that just ended", () => {
  const at = new Date("2026-09-14T05:00:00.000Z");

  const pending = championshipService.pendingClose(at);

  assert.equal(pending.startedAt.toISOString(), MONDAY);
  assert.equal(pending.endedAt.toISOString(), NEXT_MONDAY);
});
