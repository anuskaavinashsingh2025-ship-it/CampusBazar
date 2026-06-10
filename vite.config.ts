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

  // 🔧 FIX: Tell the build to package for Vercel.
  // Without this, the Nitro deploy plugin is skipped outside Lovable's sandbox,
  // so the build just emits a raw .output/ folder that Vercel doesn't know
  // how to serve — hence the 404. Setting preset: "vercel" makes Nitro emit
  // the .vercel/output/ Build Output API format that Vercel auto-detects.
  nitro: {
    preset: "vercel",
  },

  tanstackStart: {
    server: {
      entry: "server",
    },
  },
});
