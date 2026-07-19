import path from "path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { mockRequest } from "./mockDevServer";

function devMockPlugin(useMocks: boolean): Plugin {
  return {
    name: "dev-mock-api",
    configureServer(server) {
      if (!useMocks) return;

      server.middlewares.use(async (req, res, next) => {
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const useMocks = env.VITE_DEV_MODE === "true";

  return {
    plugins: [react(), devMockPlugin(useMocks)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: { outDir: "../server/public", emptyOutDir: true },
    ...(useMocks
      ? {}
      : { server: { proxy: { "/api": "http://localhost:3000" } } }),
  };
});
