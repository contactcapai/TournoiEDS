import express from "express";
import cors from "cors";
import playersRouter from "./routes/players";
import authRouter from "./routes/auth";
import adminRouter from "./routes/admin";
import tournamentRouter from "./routes/tournament";
import finaleRouter from "./routes/finale";
import rankingsRouter from "./routes/rankings";
import { requireAuth } from "./middleware/auth";

const app = express();

const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(cors({ origin: frontendUrl }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ data: { status: "ok" } });
});

// Routes publiques
app.use("/api", authRouter);
app.use("/api", playersRouter);
app.use("/api/rankings", rankingsRouter);

// Routes admin protegees par JWT
app.use("/api/admin", requireAuth);
app.use("/api/admin", adminRouter);
app.use("/api/admin", tournamentRouter);
app.use("/api/admin/finale", finaleRouter);

app.get("/api/admin/health", (_req, res) => {
  res.json({ data: { status: "ok", admin: true } });
});

// Error handler global — evite l'exposition de stack traces
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Une erreur interne est survenue" },
    });
  }
);

export default app;
