import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const reportPath = resolve(dirname(fileURLToPath(import.meta.url)), "data/last-live-scan.json");

export function subkillReportPlugin(): Plugin {
  return {
    name: "subkill-report",
    configureServer(server) {
      server.middlewares.use("/__subkill_report", (req, res, next) => {
        if (req.method !== "POST") return next();
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c as Buffer));
        req.on("end", () => {
          try {
            mkdirSync(dirname(reportPath), { recursive: true });
            writeFileSync(reportPath, Buffer.concat(chunks));
            res.statusCode = 204;
            res.end();
          } catch {
            res.statusCode = 500;
            res.end("write failed");
          }
        });
      });
    },
  };
}
