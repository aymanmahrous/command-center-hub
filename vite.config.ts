import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
});
