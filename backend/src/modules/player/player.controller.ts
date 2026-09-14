import { BaseController } from "arkos/controllers";
import { ArkosRequest, ArkosResponse } from "arkos";
import { AppError } from "arkos/error-handler";
import playerService, { MATCH_HISTORY } from "./player.service";

class PlayerController extends BaseController {
  async getMyPlayer(req: ArkosRequest, res: ArkosResponse) {
    const player = await playerService.findByUserId(req.user!.id);
    if (!player)
      throw new AppError("Player profile not found", 404, "NotFound");
    res.status(200).json({ status: "success", data: player });
  }

  async getRanking(req: ArkosRequest, res: ArkosResponse) {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit as string) || 20)
    );
    const result = await playerService.findRanking(page, limit);
    res.status(200).json({ status: "success", ...result });
  }

  async getProfile(req: ArkosRequest, res: ArkosResponse) {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      MATCH_HISTORY.max,
      Math.max(1, parseInt(req.query.limit as string) || MATCH_HISTORY.default)
    );
    const profile = await playerService.findProfile(req.params.id, page, limit);
    if (!profile)
      throw new AppError("Player profile not found", 404, "NotFound");

    res.status(200).json({ status: "success", ...profile });
  }
}

const playerController = new PlayerController("player");

(playerController as any).interceptors = { afterFindMany: [] };

export default playerController;
