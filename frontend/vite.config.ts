import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

// Dev (`vite`): served at / on :5173, proxying /api to the Frappe bench.
// Build (`vite build`): emits into the Frappe app's public/ folder, which
// Frappe serves at /assets/hotelpms/frontend/. The served SPA mounts at /hotelpms
// (see the router basename in main.tsx and website_route_rules in hooks.py).
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/assets/hotelpms/frontend/" : "/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../hotelpms/public/frontend",
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    // Defaults preserved; override with env when the standard ports are taken
    // (e.g. HOTELPMS_DEV_PORT=5174 HOTELPMS_API_TARGET=http://localhost:8080).
    port: Number(process.env.HOTELPMS_DEV_PORT) || 5173,
    proxy: {
      "/api": {
        target: process.env.HOTELPMS_API_TARGET || "http://localhost:8000",
        headers: { Host: "hotelpms.localhost" },
      },
    },
  },
}))
