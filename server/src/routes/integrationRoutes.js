import { Router } from "express";
import { config, isFailSafeMode } from "../config.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/bi", requireAuth, (req, res) => {
  res.json({
    powerBi: {
      configured: Boolean(config.powerBi.embedUrl && config.powerBi.reportId),
      embedUrl: config.powerBi.embedUrl,
      reportId: config.powerBi.reportId
    },
    tableau: {
      configured: Boolean(config.tableau.embedUrl),
      embedUrl: config.tableau.embedUrl
    },
    failSafeMode: isFailSafeMode
  });
});

router.post("/ai-insights", requireAuth, (req, res) => {
  const insights = Array.isArray(req.body?.insights) ? req.body.insights : [];
  if (!config.openAiKey) {
    res.json({
      source: "failsafe",
      summary:
        insights.join(" ") ||
        "Upload a sales file to generate insights. Add OPENAI_API_KEY later for model-generated commentary."
    });
    return;
  }

  res.json({
    source: "configured",
    summary:
      "OPENAI_API_KEY is configured. Connect this endpoint to your approved model gateway before sending business data outside your network."
  });
});

export default router;
