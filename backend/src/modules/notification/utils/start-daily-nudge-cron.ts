import cron from "node-cron";
import dailyNudgeService from "../daily-nudge.service";

/** Evening in Maputo: late enough to catch the day, early enough to still play. */
const EVENING = "0 19 * * *";

export default function startDailyNudgeCron() {
  // No boot catch-up: a nudge is about the hour it lands in, so a missed one is dropped.
  cron.schedule(
    EVENING,
    () =>
      dailyNudgeService
        .run()
        .catch((error) => console.error("[daily-nudge] run failed", error)),
    { timezone: "Africa/Maputo" }
  );
}
