import { defineConfig } from "vite";

export default defineConfig({
  base: "/ui/",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/auth": "http://127.0.0.1:8000",
      "/freelancers": "http://127.0.0.1:8000",
      "/post-job": "http://127.0.0.1:8000",
      "/upload-resume": "http://127.0.0.1:8000",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
