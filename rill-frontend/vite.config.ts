import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  // Required for production deploy (Vercel). Lovable sandbox auto-enables nitro; local/Vercel need this.
  nitro: {
    preset: process.env.VERCEL ? "vercel" : "node-server",
  },
});
