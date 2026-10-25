import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  root: "web",
  publicDir: "../public",
  resolve: { alias: { "/src": new URL("./src", import.meta.url).pathname } },
  plugins: [react()],
  base: mode === "pages" ? "/Aktienguru/" : "/",
  build: { outDir: "../dist", emptyOutDir: true },
  define: { __GURU_STATIC__: JSON.stringify(mode === "pages") },
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
}));
