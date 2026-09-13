import { ArkosRouter } from "arkos";
import arkosConfig from "@/arkos.config";
import playerRouter from "./modules/player/player.router";
import championshipRouter from "./modules/championship/championship.router";

const router = ArkosRouter({
  prefix: arkosConfig.globalPrefix || "/api",
});

router.use([playerRouter, championshipRouter]);

export default router;
