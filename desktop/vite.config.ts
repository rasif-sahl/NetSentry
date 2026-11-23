import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { outDir: "dist/renderer", emptyOutDir: true },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    fs: {
      allow: [
        fileURLToPath(new URL(".", import.meta.url)),
        fileURLToPath(new URL("../assets/brand/", import.meta.url)),
      ],
    },
  },
});
