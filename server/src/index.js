import express from "express";
import cors from "cors";
import helmet from "helmet";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { config, isFailSafeMode } from "./config.js";
import { initPostgres } from "./db.js";
import authRoutes from "./routes/authRoutes.js";
import datasetRoutes from "./routes/datasetRoutes.js";
import integrationRoutes from "./routes/integrationRoutes.js";

const app = express();
const limiter = new RateLimiterMemory({ points: 120, duration: 60 });

app.use(helmet());
app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(async (req, res, next) => {
  try {
    await limiter.consume(req.ip);
    next();
  } catch {
    res.status(429).json({ message: "Too many requests. Please slow down." });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mode: isFailSafeMode ? "fail-safe-json" : "postgres",
    time: new Date().toISOString()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/datasets", datasetRoutes);
app.use("/api/integrations", integrationRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found." });
});

app.use((error, req, res, next) => {
  const status = error.status || error.statusCode || 500;
  const message = error.errors?.[0]?.message || error.message || "Something went wrong.";
  res.status(status).json({ message });
});

await initPostgres();

app.listen(config.port, () => {
  console.log(`Sales analytics API running on http://localhost:${config.port}`);
  console.log(`Storage mode: ${isFailSafeMode ? "fail-safe JSON" : "PostgreSQL"}`);
});
