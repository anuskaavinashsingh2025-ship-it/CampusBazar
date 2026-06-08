import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      allowedHosts: true,
    },

    preview: {
      allowedHosts: true,
    },
  },

  tanstackStart: {
    server: {
      entry: "server",
    },
  },
});