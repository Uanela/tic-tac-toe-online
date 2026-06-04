import { ArkosResponse, ArkosRouter, RouteHook } from "arkos";
import playerController from "./player.controller";
import { z } from "zod";
import { onlineSockets } from "../game/controllers/tic-tac-toe.controller";
import { Player } from "@prisma/client";

export const hook: RouteHook = {
  // findMany: { authentication: false },
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
  playerController.findMany,
  (_, res: ArkosResponse<any, { data: { data: Player[] } }>) => {
    res.locals.data.data = res.locals.data.data.map((player) => ({
      ...player,
      isOnline: onlineSockets.some((socket) => socket.userId === player.userId),
    }));

    res.json(res.locals.data);
  }
);

playerRouter.get(
  { path: "/public/online-count", authentication: true },
  (req, res: ArkosResponse<any, { data: { data: Player[] } }>) => {
    res.json({
      data: {
        count: onlineSockets.filter((socket) => socket.userId != req.user?.id)
          .length,
      },
    });
  }
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
