import startGameCron from "../modules/game/utils/start-game-cron";
import startChampionshipCron from "../modules/championship/utils/start-championship-cron";
import startRankAlertCron from "../modules/notification/utils/start-rank-alert-cron";
import startDailyNudgeCron from "../modules/notification/utils/start-daily-nudge-cron";

export default function startCron() {
  startGameCron();
  startChampionshipCron();
  startRankAlertCron();
  startDailyNudgeCron();
}
