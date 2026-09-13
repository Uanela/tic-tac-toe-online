import { ArkosRouter } from "arkos";
import championshipController from "./championship.controller";

const championshipRouter = ArkosRouter({
  prefix: "/championship",
  openapi: { tags: ["Championship"] },
});

championshipRouter.get(
  { path: "/ranking", authentication: false },
  championshipController.getRanking
);

championshipRouter.get(
  { path: "/winners", authentication: false },
  championshipController.getWinners
);

export default championshipRouter;
