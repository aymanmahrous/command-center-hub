import { defineConfig, loadEnv, type Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import process from "node:process";
import react from "@vitejs/plugin-react";
import { handleAuthBootstrap, handleAuthSession, handleAuthLogout } from "./server/auth";

function localAuthApiPlugin(): Plugin {
  return {
    name: "command-center-auth-api",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        const handlers = {
          "/api/auth/bootstrap": handleAuthBootstrap,
          "/api/auth/session": handleAuthSession,
          "/api/auth/logout": handleAuthLogout,
        };
        const handler = handlers[pathname as keyof typeof handlers];
        if (!handler) {
          next();
          return;
        }
        void handler(
          request as IncomingMessage & { body?: unknown },
          response as ServerResponse,
        ).catch(() => {
          if (response.writableEnded) return;
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.end(JSON.stringify({ success: false, code: "AUTH_SERVICE_UNAVAILABLE" }));
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const localEnv = loadEnv(mode, process.cwd(), "");
  for (const key of [
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_ANON_KEY",
    "VITE_STAFF_PROFILE_TABLE",
  ]) {
    if (!process.env[key] && localEnv[key]) process.env[key] = localEnv[key];
  }

  return {
    define: {
      __VERCEL_ENV__: JSON.stringify(process.env.VERCEL_ENV ?? "development"),
    },
    plugins: [react(), localAuthApiPlugin()],
    server: {
      host: "0.0.0.0",
      port: 5000,
      allowedHosts: [".manus.computer"],
    },
    preview: {
      host: "0.0.0.0",
      port: 5000,
      allowedHosts: [".manus.computer"],
    },
    build: {
      target: "es2022",
    },
  };
});
