import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app";
import { createWebSocketServer } from "./websocket/server";
import { setIO } from "./websocket/io";

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Defense in Depth : en production, refuser tout defaut silencieux sur les
// variables critiques. Un backend qui demarre sur un JWT_SECRET dev = faille.
const DEV_DEFAULTS: Record<string, string> = {
  JWT_SECRET: 'dev-secret-tournoi-tft-eds-2026-change-in-production',
};

if (NODE_ENV === 'production') {
  const required = ['FRONTEND_URL', 'JWT_SECRET', 'DATABASE_URL'] as const;
  for (const name of required) {
    const value = process.env[name];
    if (!value) {
      console.error(`FATAL: ${name} environment variable is required in production`);
      process.exit(1);
    }
    if (DEV_DEFAULTS[name] && value === DEV_DEFAULTS[name]) {
      console.error(`FATAL: ${name} is set to the dev default in production (must be rotated)`);
      process.exit(1);
    }
  }
}

const httpServer = http.createServer(app);
const io = createWebSocketServer(httpServer);
setIO(io);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (HTTP + Socket.IO)`);
});
