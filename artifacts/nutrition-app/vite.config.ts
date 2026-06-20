import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

function apiPreflightPlugin(apiTarget: string): Plugin {
  const verifyApi = async () => {
    const healthUrl = new URL("/api/healthz", apiTarget).toString();
    let response: Response;
    try {
      response = await fetch(healthUrl, { signal: AbortSignal.timeout(3_000) });
    } catch {
      throw new Error(
        `NutriBasket API is unavailable at ${apiTarget}. Start the API and database first, then retry.`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `NutriBasket API health check failed with HTTP ${response.status} at ${healthUrl}. Check DATABASE_URL and the API logs.`,
      );
    }

    const body = await response.json() as { status?: unknown; service?: unknown };
    if (body.status !== "ok" || body.service !== "nutribasket-api") {
      throw new Error(
        `The service at ${apiTarget} is not the NutriBasket API. Set VITE_API_TARGET to the correct API origin.`,
      );
    }
  };

  return {
    name: "nutribasket-api-preflight",
    configureServer: verifyApi,
    configurePreviewServer: verifyApi,
  };
}

export default defineConfig(async ({ command }) => {
  const resolvedApiTarget = process.env.VITE_API_TARGET ?? "http://127.0.0.1:8080";

  return {
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(command === "serve" ? [apiPreflightPlugin(resolvedApiTarget)] : []),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: resolvedApiTarget,
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: resolvedApiTarget,
        changeOrigin: true,
      },
    },
  },
  };
});
