import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { subkillReportPlugin } from "./vite.report-plugin";

export default defineConfig({
  plugins: [react(), subkillReportPlugin()],
  server: {
    port: 5174,
    strictPort: true,
  },
});
