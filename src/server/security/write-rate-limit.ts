import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "server-only";

const dataDirectory = path.join(process.cwd(), "data");
const localRateLimitStorePath = path.join(dataDirectory, "local-write-rate-limits.json");

type RateLimitStore = Record<string, number[]>;

async function ensureStore() {
  await mkdir(dataDirectory, { recursive: true });
  try {
    await readFile(localRateLimitStorePath, "utf8");
  } catch {
    await writeFile(localRateLimitStorePath, "{}\n", "utf8");
  }
}

async function readStore(): Promise<RateLimitStore> {
  await ensureStore();
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

async function writeStore(store: RateLimitStore) {
  await ensureStore();
  await writeFile(localRateLimitStorePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export async function consumeWriteRateLimit(params: {
  scope: string;
  actorKey: string;
  windowMs: number;
  maxHits: number;
}) {
  const now = Date.now();
  const key = `${params.scope}:${params.actorKey}`;
  const store = await readStore();
  const existing = store[key] ?? [];
  const windowStart = now - params.windowMs;
  const recent = existing.filter((timestamp) => timestamp >= windowStart);

  if (recent.length >= params.maxHits) {
    const firstHit = recent[0];
    const retryAfterMs = Math.max(0, params.windowMs - (now - firstHit));
    store[key] = recent;
    await writeStore(store);
    return {
      allowed: false,
      retryAfterMs,
      remaining: 0,
      currentHits: recent.length,
    };
  }

  const next = [...recent, now];
  store[key] = next;
  await writeStore(store);

  return {
    allowed: true,
    retryAfterMs: 0,
    remaining: Math.max(0, params.maxHits - next.length),
    currentHits: next.length,
  };
}
