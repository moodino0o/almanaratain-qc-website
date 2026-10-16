import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "/frontend/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(projectRoot, "src") },
      {
        find: "@workspace/api-client-react",
        replacement: path.resolve(projectRoot, "../standalone-libs/api-client-react/src/index.ts"),
      },
      {
        find: "@workspace/replit-auth-web",
        replacement: path.resolve(projectRoot, "src/lib/standalone-auth.ts"),
      },
    ],
    dedupe: ["react", "react-dom"],
  },
  root: projectRoot,
  publicDir: false,
  build: {
    outDir: path.resolve(projectRoot, "../../public/frontend"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT ?? 5173),
    allowedHosts: true,
  },
});
