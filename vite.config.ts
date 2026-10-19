import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

const env = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
const port = Number(env.PORT || process.env.PORT) || 8083;

export default defineConfig({
  vite: {
    server: {
      host: true,
      port,
      // Allow opening the app from another PC on the LAN (e.g. http://192.168.x.x:8083).
      allowedHosts: true,
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});

