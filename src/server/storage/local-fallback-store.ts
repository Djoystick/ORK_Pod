import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "server-only";

import { contentItems, sourceChannels } from "@/data";
import type {
  CommentRecord,
  ContentItem,
  ImportRun,
  IngestionLockSnapshot,
  ReactionRecord,
  SourceChannel,
} from "@/types/content";

const dataDirectory = path.join(process.cwd(), "data");
const localContentStorePath = path.join(dataDirectory, "local-content-items.json");
const legacyManualStorePath = path.join(dataDirectory, "manual-content-items.json");
const localSourceChannelsPath = path.join(dataDirectory, "local-source-channels.json");
const localImportRunsPath = path.join(dataDirectory, "local-import-runs.json");
const localIngestionLocksPath = path.join(dataDirectory, "local-ingestion-locks.json");
const localCommentsPath = path.join(dataDirectory, "local-comments.json");
const localReactionsPath = path.join(dataDirectory, "local-reactions.json");

async function ensureDataDirectory() {
  await mkdir(dataDirectory, { recursive: true });
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value);
}

async function readJson(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function readJsonArray(filePath: string) {
  const parsed = await readJson(filePath);
  return isRecordArray(parsed) ? parsed : [];
}

async function ensureLocalContentStore() {
  await ensureDataDirectory();

  try {
    await readFile(localContentStorePath, "utf8");
    return;
  } catch {
    const legacyManual = (await readJsonArray(legacyManualStorePath)) as unknown as ContentItem[];
    const merged = [...contentItems];

    for (const item of legacyManual) {
      const duplicate = merged.find(
        (existing) => existing.id === item.id || existing.slug === item.slug,
      );
      if (!duplicate) {
        merged.push(item);
      }
    }

    await writeFile(localContentStorePath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  }
}

async function ensureLocalSourceChannelStore() {
  await ensureDataDirectory();

  try {
    await readFile(localSourceChannelsPath, "utf8");
    return;
  } catch {
    await writeFile(
      localSourceChannelsPath,
      `${JSON.stringify(sourceChannels, null, 2)}\n`,
      "utf8",
    );
  }
}

async function ensureLocalImportRunStore() {
  await ensureDataDirectory();

  try {
    await readFile(localImportRunsPath, "utf8");
    return;
  } catch {
    await writeFile(localImportRunsPath, "[]\n", "utf8");
  }
}

async function ensureLocalIngestionLockStore() {
  await ensureDataDirectory();

  try {
    await readFile(localIngestionLocksPath, "utf8");
    return;
  } catch {
    await writeFile(
      localIngestionLocksPath,
      `${JSON.stringify({ globalSyncAllLock: null, sourceLocks: [] }, null, 2)}\n`,
      "utf8",
    );
  }
}

async function ensureLocalCommentsStore() {
  await ensureDataDirectory();

  try {
    await readFile(localCommentsPath, "utf8");
    return;
  } catch {
    await writeFile(localCommentsPath, "[]\n", "utf8");
  }
}

async function ensureLocalReactionsStore() {
  await ensureDataDirectory();

  try {
    await readFile(localReactionsPath, "utf8");
    return;
  } catch {
    await writeFile(localReactionsPath, "[]\n", "utf8");
  }
}

export async function readLocalFallbackContentItems() {
  await ensureLocalContentStore();
  const parsed = (await readJsonArray(localContentStorePath)) as unknown as ContentItem[];
  return parsed;
}

export async function writeLocalFallbackContentItems(items: ContentItem[]) {
  await ensureDataDirectory();
  await writeFile(localContentStorePath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

export async function readLocalFallbackSourceChannels() {
  await ensureLocalSourceChannelStore();
  const parsed = (await readJsonArray(localSourceChannelsPath)) as unknown as SourceChannel[];
  return parsed;
}

export async function writeLocalFallbackSourceChannels(channels: SourceChannel[]) {
  await ensureDataDirectory();
  await writeFile(localSourceChannelsPath, `${JSON.stringify(channels, null, 2)}\n`, "utf8");
}

export async function readLocalFallbackImportRuns() {
  await ensureLocalImportRunStore();
  const parsed = (await readJsonArray(localImportRunsPath)) as unknown as ImportRun[];
  return parsed;
}

export async function writeLocalFallbackImportRuns(runs: ImportRun[]) {
  await ensureDataDirectory();
  await writeFile(localImportRunsPath, `${JSON.stringify(runs, null, 2)}\n`, "utf8");
}

export async function readLocalIngestionLocks() {
  await ensureLocalIngestionLockStore();
  const parsed = await readJson(localIngestionLocksPath);

  if (Array.isArray(parsed) || !parsed || typeof parsed !== "object") {
    return {
      globalSyncAllLock: null,
      sourceLocks: [],
    } satisfies IngestionLockSnapshot;
  }

  const asRecord = parsed as Record<string, unknown>;
  return {
    globalSyncAllLock:
      asRecord.globalSyncAllLock && typeof asRecord.globalSyncAllLock === "object"
        ? (asRecord.globalSyncAllLock as IngestionLockSnapshot["globalSyncAllLock"])
        : null,
    sourceLocks: Array.isArray(asRecord.sourceLocks)
      ? (asRecord.sourceLocks as IngestionLockSnapshot["sourceLocks"])
      : [],
  } satisfies IngestionLockSnapshot;
}

export async function writeLocalIngestionLocks(snapshot: IngestionLockSnapshot) {
  await ensureDataDirectory();
  await writeFile(localIngestionLocksPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

export async function readLocalFallbackComments() {
  await ensureLocalCommentsStore();
  const parsed = (await readJsonArray(localCommentsPath)) as unknown as CommentRecord[];
  return parsed;
}

export async function writeLocalFallbackComments(comments: CommentRecord[]) {
  await ensureDataDirectory();
  await writeFile(localCommentsPath, `${JSON.stringify(comments, null, 2)}\n`, "utf8");
}

export async function readLocalFallbackReactions() {
  await ensureLocalReactionsStore();
  const parsed = (await readJsonArray(localReactionsPath)) as unknown as ReactionRecord[];
  return parsed;
}

export async function writeLocalFallbackReactions(reactions: ReactionRecord[]) {
  await ensureDataDirectory();
  await writeFile(localReactionsPath, `${JSON.stringify(reactions, null, 2)}\n`, "utf8");
}
