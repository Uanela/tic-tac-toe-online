import app from "@/src/app";
import http from "node:http";
import { Server } from "socket.io";
import gateway from "./gateway";
import startCron from "./utils/start-cron";
import { setIo } from "./utils/feed-ping";

await app.build();

startCron();

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: true, credentials: true, methods: ["GET", "POST"] },
  path: "/api/socket.io",
});

gateway.register(io);
setIo(io);

app.listen(server);
