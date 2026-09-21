import cron from "node-cron";
import rankAlertService from "../rank-alert.service";

const HOURLY = "23 * * * *";

export default function startRankAlertCron() {
  const run = () =>
    rankAlertService
      .check()
      .catch((error) => console.error("[rank-alert] rank check failed", error));

  cron.schedule(HOURLY, run);

  run();
}
