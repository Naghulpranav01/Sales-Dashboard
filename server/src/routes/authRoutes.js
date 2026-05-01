import { Router } from "express";
import { z } from "zod";
import { login, signup } from "../services/authService.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const authSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(128)
});

router.post("/signup", async (req, res, next) => {
  try {
    const body = authSchema.extend({ name: z.string().trim().min(2).max(80) }).parse(req.body);
    res.status(201).json(await signup(body));
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const body = authSchema.parse(req.body);
    res.json(await login(body));
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post("/logout", requireAuth, (req, res) => {
  res.status(204).send();
});

export default router;
