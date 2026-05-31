import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // force: true, // always re-bundle (slower startup but always fresh)
    // or just exclude the specific package from pre-bundling:
    exclude: ["@arkosjs/react-websockets", "@arkosjs/websockets-client"],
  },
  resolve: {
    alias: {
      react: path.resolve("./node_modules/react"),
      "react-dom": path.resolve("./node_modules/react-dom"),
    },
  },
});
