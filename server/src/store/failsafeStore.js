import fs from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import { config } from "../config.js";
import { stableId } from "../utils.js";

const usersPath = path.join(config.failSafeDataDir, "users.json");
const datasetsPath = path.join(config.failSafeDataDir, "datasets.json");

async function ensureFiles() {
  await fs.mkdir(config.failSafeDataDir, { recursive: true });
  await Promise.all([
    fs.access(usersPath).catch(() => fs.writeFile(usersPath, "[]")),
    fs.access(datasetsPath).catch(() => fs.writeFile(datasetsPath, "[]"))
  ]);
}

async function readJson(filePath) {
  await ensureFiles();
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw || "[]");
}

async function writeJson(filePath, data) {
  await ensureFiles();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function createFailSafeUser({ name, email, password }) {
  const users = await readJson(usersPath);
  const existing = users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    const error = new Error("Email is already registered.");
    error.status = 409;
    throw error;
  }

  const user = {
    id: stableId("usr"),
    name,
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
    role: "analyst",
    createdAt: new Date().toISOString()
  };
  users.push(user);
  await writeJson(usersPath, users);
  return user;
}

export async function findFailSafeUserByEmail(email) {
  const users = await readJson(usersPath);
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) || null;
}

export async function findFailSafeUserById(id) {
  const users = await readJson(usersPath);
  return users.find((user) => user.id === id) || null;
}

export async function upsertFailSafeDataset(dataset) {
  const datasets = await readJson(datasetsPath);
  const index = datasets.findIndex(
    (item) => item.userId === dataset.userId && item.displayName === dataset.displayName
  );

  const saved = {
    ...(index >= 0 ? datasets[index] : {}),
    ...dataset,
    id: index >= 0 ? datasets[index].id : stableId("dst"),
    updatedAt: new Date().toISOString(),
    createdAt: index >= 0 ? datasets[index].createdAt : new Date().toISOString()
  };

  if (index >= 0) datasets[index] = saved;
  else datasets.push(saved);

  await writeJson(datasetsPath, datasets);
  return saved;
}

export async function listFailSafeDatasets(userId) {
  const datasets = await readJson(datasetsPath);
  return datasets
    .filter((dataset) => dataset.userId === userId)
    .map(({ rows, ...dataset }) => dataset)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function getFailSafeDataset(userId, datasetId) {
  const datasets = await readJson(datasetsPath);
  return datasets.find((dataset) => dataset.userId === userId && dataset.id === datasetId) || null;
}
