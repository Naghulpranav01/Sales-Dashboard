import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { findUserById } from "../services/authService.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [, token] = header.match(/^Bearer (.+)$/) || [];
    if (!token) {
      const error = new Error("Authentication token is required.");
      error.status = 401;
      throw error;
    }

    const payload = jwt.verify(token, config.jwtSecret);
    const user = await findUserById(payload.id);
    if (!user) {
      const error = new Error("User no longer exists.");
      error.status = 401;
      throw error;
    }

    req.user = user;
    next();
  } catch (error) {
    error.status = error.status || 401;
    next(error);
  }
}
