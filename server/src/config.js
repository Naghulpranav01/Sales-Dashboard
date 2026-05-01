import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 8080),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || "dev-only-change-this-secret",
  databaseUrl: process.env.DATABASE_URL || "",
  failSafeDataDir: process.env.FAILSAFE_DATA_DIR || "./data",
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 15 * 1024 * 1024),
  schemaEvolutionDropColumns: process.env.SCHEMA_EVOLUTION_DROP_COLUMNS !== "false",
  powerBi: {
    embedUrl: process.env.POWER_BI_EMBED_URL || "",
    reportId: process.env.POWER_BI_REPORT_ID || ""
  },
  tableau: {
    embedUrl: process.env.TABLEAU_EMBED_URL || ""
  },
  openAiKey: process.env.OPENAI_API_KEY || ""
};

export const isFailSafeMode = !config.databaseUrl;
