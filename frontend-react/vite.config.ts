import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
      // `localStorage` is what makes the switcher's choice survive a reload;
      // `baseLocale` is the "default to pt" fallback for a first-time visitor.
      // No `url` strategy on purpose: the invite links are handed out as
      // `/play?inviteId=...`, and a locale prefix would break them.
      strategy: ["localStorage", "baseLocale"],
      // `src/paraglide` is gitignored and `build` runs tsc before vite, so
      // `prebuild` compiles the same options first — keep the two in sync.
      emitTsDeclarations: true,
    }),
  ],
  resolve: {
    alias: {
      react: path.resolve("./node_modules/react"),
      "react-dom": path.resolve("./node_modules/react-dom"),
    },
  },
  server: {
    allowedHosts: true,
  },
  optimizeDeps: {
    exclude: ["@arkosjs/react-websockets"]
  }
});
