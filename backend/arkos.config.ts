import { defineConfig } from "arkos/config";

const arkosConfig = defineConfig({
  source: {
    entryPoint: "src/server.ts",
  },
  authentication: {
    mode: "static",
    login: {
      allowedUsernames: ["email"],
    },
  },
  routers: {
    strict: "no-bulk",
  },
  validation: {
    resolver: "zod",
  },
  swagger: {
    mode: "zod",
    strict: false,
  },
  middlewares: {
    cors: {},
  },
  debugging: {
    requests: {
      filter: ["PrismaFinalQueryArgs"],
      level: 1,
    },
  },
});

export default arkosConfig;
