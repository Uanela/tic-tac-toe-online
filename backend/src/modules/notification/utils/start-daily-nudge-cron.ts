import cron from "node-cron";
import dailyNudgeService from "../daily-nudge.service";

const EVENING = "30 19 * * *";

export default function startDailyNudgeCron() {
  cron.schedule(
    EVENING,
    () =>
      dailyNudgeService
        .run()
        .catch((error) => console.error("[daily-nudge] run failed", error)),
    { timezone: "Africa/Maputo" }
  );
}
