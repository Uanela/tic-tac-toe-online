import { ArkosRouter, RouteHook } from "arkos";
import playerController from "./player.controller";
import { z } from "zod";

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
  {
    path: "/public",
    authentication: false,
    validation: {
      query: z.object({
        nickname__icontains: z.string(),
        limit: z.number().max(10).default(6),
      }),
    },
  },
  playerController.findMany
);

playerRouter.get(
  { path: "/me", authentication: true },
  playerController.getMyPlayer
);

playerRouter.get(
  { path: "/ranking", authentication: false },
  playerController.getRanking
);

export default playerRouter;
