import { ArkosResponse, ArkosRouter, RouteHook } from "arkos";
import playerController from "./player.controller";
import { z } from "zod";
import { onlineSockets } from "../game/controllers/tic-tac-toe.controller";
import { Player } from "@prisma/client";
import playerService from "./player.service";
import playerBotService from "./player-bot.service";
import { authService } from "arkos/services";

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
  async (_, res: ArkosResponse<any, { data: { data: Omit<Player, "type">[] } }>) => {
    const availableBotIds = new Set(
      (await playerBotService.findAvailable()).map((bot) => bot.userId)
    );

    res.locals.data.data = res.locals.data.data.map((player) => {
      const { type, ...row } = player as Player;
      return {
        ...row,
        isOnline:
          availableBotIds.has(player.userId) ||
          onlineSockets.some((socket) => socket.userId === player.userId),
      };
    });

    res.json(res.locals.data);
  }
);

playerRouter.get(
  { path: "/public/online", authentication: false },
  async (req, res: ArkosResponse<any, { data: { data: Omit<Player, "type">[] } }>) => {
    const currentUser = await authService.getAuthenticatedUser(req);
    const sockets = onlineSockets.filter(
      (socket) => socket.userId !== currentUser?.id
    );

    const [players, bots] = await Promise.all([
      playerService.findMany(
        { userId: { in: sockets.map((s) => s.userId) } },
        { omit: { type: true } }
      ),
      playerBotService.findAvailable(),
    ]);

    const data = [
      ...players.map((player) => ({ ...player, isOnline: true })),
      ...bots.map((bot) => ({ ...bot, isOnline: true })),
    ];

    res.json({ count: data.length, data });
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
