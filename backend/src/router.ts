import { ArkosRouter } from "arkos";
import arkosConfig from "@/arkos.config";
import playerRouter from "./modules/player/player.router";

const router = ArkosRouter({
  prefix: arkosConfig.globalPrefix || "/api",
});

router.use([playerRouter]);

export default router;
