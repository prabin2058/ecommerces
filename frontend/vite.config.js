/* eslint-env node */
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [react()],
    server: {
      port: env.VITE_PORT,
      // Forward API calls to the Express backend so cookies stay same-origin (no CORS needed).
      // /mock-gateway is the sandbox payment provider's hosted page, also served by the backend.
      proxy: env.VITE_PROXY_TARGET
        ? {
            "/api": { target: env.VITE_PROXY_TARGET, xfwd: true },
            "/images": env.VITE_PROXY_TARGET,
            "/mock-gateway": env.VITE_PROXY_TARGET,
          }
        : undefined,
    },
  };
});
