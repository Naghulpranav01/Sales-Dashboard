import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { config, isFailSafeMode } from "../config.js";
import { query } from "../db.js";
import {
  createFailSafeUser,
  findFailSafeUserByEmail,
  findFailSafeUserById
} from "../store/failsafeStore.js";

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || "analyst"
  };
}

function signToken(user) {
  return jwt.sign(publicUser(user), config.jwtSecret, { expiresIn: "12h" });
}

export async function signup({ name, email, password }) {
  const user = isFailSafeMode
    ? await createFailSafeUser({ name, email, password })
    : await createPostgresUser({ name, email, password });

  return { user: publicUser(user), token: signToken(user) };
}

export async function login({ email, password }) {
  const user = isFailSafeMode
    ? await findFailSafeUserByEmail(email)
    : await findPostgresUserByEmail(email);

  if (!user) {
    const error = new Error("Invalid email or password.");
    error.status = 401;
    throw error;
  }

  const hash = user.passwordHash || user.password_hash;
  const valid = await bcrypt.compare(password, hash);
  if (!valid) {
    const error = new Error("Invalid email or password.");
    error.status = 401;
    throw error;
  }

  return { user: publicUser(user), token: signToken(user) };
}

export async function findUserById(id) {
  if (isFailSafeMode) {
    const user = await findFailSafeUserById(id);
    return user ? publicUser(user) : null;
  }

  const result = await query(
    "select id, name, email, role from app_users where id = $1",
    [id]
  );
  return result.rows[0] || null;
}

async function createPostgresUser({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const result = await query(
      `
        insert into app_users (id, name, email, password_hash, role)
        values ($1, $2, $3, $4, 'analyst')
        returning id, name, email, password_hash, role
      `,
      [uuidv4(), name, email.toLowerCase(), passwordHash]
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === "23505") {
      error.status = 409;
      error.message = "Email is already registered.";
    }
    throw error;
  }
}

async function findPostgresUserByEmail(email) {
  const result = await query(
    "select id, name, email, password_hash, role from app_users where email = $1",
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
}
