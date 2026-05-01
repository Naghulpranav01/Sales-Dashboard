import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { parseUploadedFile } from "../services/fileParser.js";
import { inferSchema, normalizeRows } from "../services/schemaInference.js";
import { getDatasetWithRows, listDatasets, persistDataset } from "../services/dynamicDatabase.js";
import { buildAnalytics } from "../services/analytics.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes },
  fileFilter: (req, file, cb) => {
    if (/\.(csv|xlsx)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error("Only CSV and XLSX files are supported."));
  }
});

const uploadBodySchema = z.object({
  displayName: z.string().trim().min(2).max(100).optional()
});

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    res.json({ datasets: await listDatasets(req.user.id) });
  } catch (error) {
    next(error);
  }
});

router.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      const error = new Error("A CSV or Excel file is required.");
      error.status = 400;
      throw error;
    }

    const body = uploadBodySchema.parse(req.body);
    const { headers, rows } = await parseUploadedFile(req.file);
    const schema = inferSchema(headers, rows);
    const normalizedRows = normalizeRows(rows, schema);
    const dataset = await persistDataset({
      userId: req.user.id,
      displayName: body.displayName || req.file.originalname.replace(/\.[^.]+$/, ""),
      schema,
      rows: normalizedRows
    });

    res.status(201).json({ dataset, analytics: buildAnalytics({ ...dataset, rows: normalizedRows }) });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/analytics", async (req, res, next) => {
  try {
    const dataset = await getDatasetWithRows(req.user.id, req.params.id);
    if (!dataset) {
      const error = new Error("Dataset not found.");
      error.status = 404;
      throw error;
    }
    res.json({ analytics: buildAnalytics(dataset) });
  } catch (error) {
    next(error);
  }
});

export default router;
