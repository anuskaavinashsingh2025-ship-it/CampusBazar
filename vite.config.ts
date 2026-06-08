import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      allowedHosts: ["campusbazar-production.up.railway.app"],
    },
    preview: {
      allowedHosts: ["campusbazar-production.up.railway.app"],
    },
  },

  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts
    server: {
      entry: "server",
    },
  },
});