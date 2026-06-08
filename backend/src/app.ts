import arkos from "arkos";
import router from "@/src/router";
import "./utils/start-cron";

const app = arkos();

app.set("trust proxy", 1);

app.use(router);

export default app;
