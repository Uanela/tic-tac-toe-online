import { defineConfig } from "arkos/config";

const isProduction = process.env.NODE_ENV === "production";

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
    options: {
      definition: {
        servers: [
          {
            url: "https://games.arkosjs.com",
            description: "Production server",
          },
        ],
      },
    },
  },
  middlewares: {
    cors: {
      origin: isProduction ? process.env.CORS_ORIGIN?.split(",") : true,
      credentials: true,
    },
  },
  debugging: {
    requests: {
      filter: ["PrismaFinalQueryArgs"],
      level: 1,
    },
  },
  email: {},
});

export default arkosConfig;
