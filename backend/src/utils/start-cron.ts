import startGameCron from "../modules/game/utils/start-game-cron";
import startChampionshipCron from "../modules/championship/utils/start-championship-cron";

export default function startCron() {
  startGameCron();
  startChampionshipCron();
}
