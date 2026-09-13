import { BaseController } from "arkos/controllers";
import { ArkosRequest, ArkosResponse } from "arkos";
import championshipService from "./championship.service";

class ChampionshipController extends BaseController {
  async getRanking(req: ArkosRequest, res: ArkosResponse) {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit as string) || 20)
    );

    const period = championshipService.periodFor();
    const result = await championshipService.standings(period, page, limit);

    res.status(200).json({ status: "success", period, ...result });
  }

  async getWinners(_: ArkosRequest, res: ArkosResponse) {
    const { period, winners } = await championshipService.latestWinners();

    res.status(200).json({ status: "success", period, winners });
  }
}

const championshipController = new ChampionshipController(
  "player-championship-stats"
);

export default championshipController;
