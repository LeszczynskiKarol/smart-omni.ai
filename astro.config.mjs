import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  integrations: [react(), tailwind()],
  output: "static",
  vite: {
    server: {
      allowedHosts: ["dev.torweb.pl"],
      proxy: {
        "/api": {
          target: "http://localhost:3500",
          changeOrigin: true,
        },
      },
    },
  },
});
