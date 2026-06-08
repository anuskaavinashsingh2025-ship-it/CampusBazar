import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  server: {
    allowedHosts: true,
  },

  preview: {
    allowedHosts: true,
  },

  tanstackStart: {
    server: {
      entry: "server",
    },
  },
});