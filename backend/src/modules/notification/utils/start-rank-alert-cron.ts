import cron from "node-cron";
import rankAlertService from "../rank-alert.service";

// Off the hour on purpose: the exact minute never matters to a place that has
// already been lost, and everyone else's jobs are queueing for the top of it.
const HOURLY = "23 * * * *";

export default function startRankAlertCron() {
  const run = () =>
    rankAlertService
      .check()
      .catch((error) => console.error("[rank-alert] rank check failed", error));

  cron.schedule(HOURLY, run);

  // A restart is the second chance to catch a place lost while the server was down.
  run();
}
