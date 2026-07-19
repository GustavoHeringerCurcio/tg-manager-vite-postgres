import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { mockRequest } from "./mockDevServer";

const useMocks = process.env.VITE_DEV_MODE === "true";

function devMockPlugin(): Plugin {
  return {
    name: "dev-mock-api",
    configureServer(server) {
      if (!useMocks) return;

      server.middlewares.use("/api", async (req, res, next) => {
        try {
          const handled = await mockRequest(req, res);
          if (!handled) next();
        } catch (err) {
          console.error("[dev-mock]", err);
          next();
        }
      });

      console.log("  \x1b[36m[dev-mock]\x1b[0m Mock API enabled — /api requests served from in-memory store");
    },
  };
}

export default defineConfig({
  plugins: [react(), devMockPlugin()],
  build: { outDir: "../server/public", emptyOutDir: true },
  ...(useMocks
    ? {}
    : { server: { proxy: { "/api": "http://localhost:3000" } } }),
});
