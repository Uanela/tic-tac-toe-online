import { ArkosRouter, RouteHook } from "arkos";
import playerController from "./player.controller";

export const hook: RouteHook = {
  // findMany: { disabled: true },
  // findOne: { disabled: true },
  // createOne: { disabled: true },
  updateOne: { authentication: true },
  deleteOne: { disabled: true },
};

const playerRouter = ArkosRouter({
  prefix: "/players",
  openapi: { tags: ["Players"] },
});

playerRouter.get(
  { path: "/me", authentication: true },
  playerController.getMyPlayer
);

playerRouter.get(
  { path: "/ranking", authentication: false },
  playerController.getRanking
);

export default playerRouter;
