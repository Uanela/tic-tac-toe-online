import { BaseController } from "arkos/controllers";
import { ArkosRequest, ArkosResponse } from "arkos";
import { AppError } from "arkos/error-handler";
import playerService from "./player.service";

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
}

const playerController = new PlayerController("player");

export default playerController;
