import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "server-only";

type RateLimitStore = Record<string, number[]>;
type RateLimitStoreMode = "file_local_json" | "memory_ephemeral";

const dataDirectory = path.join(process.cwd(), "data");
const localRateLimitStorePath = path.join(dataDirectory, "local-write-rate-limits.json");

declare global {
  var __ORKPOD_MEMORY_RATE_LIMIT_STORE__: RateLimitStore | undefined;
}

function resolveStoreMode(): RateLimitStoreMode {
  // Production/serverless runtimes should never write to local filesystem.
  if (process.env.NODE_ENV === "production") {
    return "memory_ephemeral";
  }

  const configured = process.env.ORKPOD_RATE_LIMIT_STORE?.trim().toLowerCase();
  if (configured === "memory") {
    return "memory_ephemeral";
  }
  if (configured === "file" || configured === "file_local_json") {
    return "file_local_json";
  }

  return "file_local_json";
}

function getMemoryStore(): RateLimitStore {
  if (!globalThis.__ORKPOD_MEMORY_RATE_LIMIT_STORE__) {
    globalThis.__ORKPOD_MEMORY_RATE_LIMIT_STORE__ = {};
  }
  return globalThis.__ORKPOD_MEMORY_RATE_LIMIT_STORE__;
}

async function ensureFileStore() {
  await mkdir(dataDirectory, { recursive: true });
  try {
    await readFile(localRateLimitStorePath, "utf8");
  } catch {
    await writeFile(localRateLimitStorePath, "{}\n", "utf8");
  }
}

async function readFileStore(): Promise<RateLimitStore> {
  await ensureFileStore();
  try {
    const raw = await readFile(localRateLimitStorePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as RateLimitStore;
  } catch {
    return {};
  }
}

async function writeFileStore(store: RateLimitStore) {
  await ensureFileStore();
  await writeFile(localRateLimitStorePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function readStore(mode: RateLimitStoreMode): Promise<RateLimitStore> {
  if (mode === "memory_ephemeral") {
    return getMemoryStore();
  }
  return readFileStore();
}

async function writeStore(mode: RateLimitStoreMode, store: RateLimitStore) {
  if (mode === "memory_ephemeral") {
    globalThis.__ORKPOD_MEMORY_RATE_LIMIT_STORE__ = store;
    return;
  }
  await writeFileStore(store);
}

export async function consumeWriteRateLimit(params: {
  scope: string;
  actorKey: string;
  windowMs: number;
  maxHits: number;
}) {
  const now = Date.now();
  const key = `${params.scope}:${params.actorKey}`;
  const mode = resolveStoreMode();
  const store = await readStore(mode);
  const existing = store[key] ?? [];
  const windowStart = now - params.windowMs;
  const recent = existing.filter((timestamp) => timestamp >= windowStart);

  if (recent.length >= params.maxHits) {
    const firstHit = recent[0];
    const retryAfterMs = Math.max(0, params.windowMs - (now - firstHit));
    store[key] = recent;
    await writeStore(mode, store);
    return {
      allowed: false,
      retryAfterMs,
      remaining: 0,
      currentHits: recent.length,
    };
  }

  const next = [...recent, now];
  store[key] = next;
  await writeStore(mode, store);

  return {
    allowed: true,
    retryAfterMs: 0,
    remaining: Math.max(0, params.maxHits - next.length),
    currentHits: next.length,
  };
}
