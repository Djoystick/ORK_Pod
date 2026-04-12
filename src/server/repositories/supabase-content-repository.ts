import "server-only";

import { resolveContentItems, sortItemsByDate } from "@/lib/content";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type {
  CommentRecord,
  CommentStatus,
  ContentItem,
  ContentStatus,
  CoverAsset,
  CreateCommentInput,
  CreateManualContentInput,
  CreateSourceChannelInput,
  ExternalLink,
  ImportRun,
  ImportRunTrigger,
  ImportStatus,
  ModerationStatus,
  ReactionRecord,
  ResolvedSourceChannel,
  SourceChannel,
  UpdateCommentModerationInput,
  UpdateContentItemInput,
  UpsertReactionInput,
  UpsertReactionResult,
} from "@/types/content";
import type { ContentRepository } from "@/types/repository";

type DbContentItemRow = {
  id: string;
  slug: string;
  title: string;
  category_id: string;
  series_id: string | null;
  platform_id: string;
  source_type: "manual" | "imported";
  content_source_id: string | null;
  external_source_id: string | null;
  import_status: ImportStatus;
  status: "draft" | "published" | "archived";
  moderation_status: ModerationStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  duration_minutes: number;
  excerpt: string;
  description: string;
  body: string | null;
  cover: unknown;
  source_payload: Record<string, unknown> | null;
  featured: boolean;
};

type DbExternalLinkRow = {
  id?: string;
  content_item_id: string;
  link_kind: ExternalLink["kind"];
  label: string;
  url: string;
  is_primary?: boolean;
};

type DbContentItemTagRow = {
  content_item_id: string;
  tag_id: string;
};

type DbSourceChannelRow = {
  id: string;
  slug: string;
  title: string;
  platform_id: string;
  external_channel_id: string | null;
  source_url: string | null;
  is_active: boolean | null;
  notes: string | null;
  last_synced_at: string | null;
  last_successful_sync_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type DbCommentRow = {
  id: string;
  content_item_id: string;
  parent_id: string | null;
  identity_mode: string | null;
  author_user_id: string | null;
  author_display: string;
  author_fingerprint: string | null;
  body: string;
  status: CommentStatus;
  moderation_status: ModerationStatus;
  moderation_reason: string | null;
  created_at: string;
  updated_at: string;
};

type DbReactionRow = {
  id: string;
  content_item_id: string;
  reaction_type: ReactionRecord["reactionType"];
  actor_user_id: string | null;
  actor_fingerprint: string | null;
  created_at: string;
};

function ensureClient() {
  const client = createSupabaseServiceClient();

  if (!client) {
    throw new Error("Supabase service config is not available");
  }

  return client;
}

function ensureValidUrl(value: string) {
  try {
    return new URL(value).toString();
  } catch {
    throw new Error("Некорректный внешний URL");
  }
}

function toCoverAsset(value: unknown, title: string): CoverAsset {
  if (typeof value === "object" && value !== null) {
    const cover = value as Partial<CoverAsset>;

    if (
      Array.isArray(cover.palette) &&
      cover.palette.length === 2 &&
      typeof cover.palette[0] === "string" &&
      typeof cover.palette[1] === "string"
    ) {
      return {
        kind: cover.kind === "image" ? "image" : "gradient",
        alt: typeof cover.alt === "string" ? cover.alt : title,
        palette: [cover.palette[0], cover.palette[1]],
        src: typeof cover.src === "string" ? cover.src : undefined,
      };
    }
  }

  return {
    kind: "gradient",
    alt: title,
    palette: ["#1D4ED8", "#0F172A"],
  };
}

function rowToContentItem(
  row: DbContentItemRow,
  links: DbExternalLinkRow[],
  tagIds: string[],
): ContentItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    categoryId: row.category_id,
    seriesId: row.series_id,
    platformId: row.platform_id,
    sourceType: row.source_type,
    contentSourceId: row.content_source_id,
    externalSourceId: row.external_source_id,
    importStatus: row.import_status,
    status: row.status,
    moderationStatus: row.moderation_status,
    tagIds,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    durationMinutes: row.duration_minutes,
    excerpt: row.excerpt,
    description: row.description,
    body: row.body ?? undefined,
    cover: toCoverAsset(row.cover, row.title),
    links: links.map((link) => ({
      kind: link.link_kind,
      label: link.label,
      url: link.url,
    })),
    sourcePayload: row.source_payload,
    featured: row.featured,
  };
}

function rowToComment(row: DbCommentRow): CommentRecord {
  return {
    id: row.id,
    contentItemId: row.content_item_id,
    parentId: row.parent_id,
    identityMode:
      row.identity_mode === "guest_cookie_v1" ? row.identity_mode : "guest_cookie_v1",
    authorUserId: row.author_user_id,
    authorDisplay: row.author_display,
    authorFingerprint: row.author_fingerprint,
    body: row.body,
    status: row.status,
    moderationStatus: row.moderation_status,
    moderationReason: row.moderation_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToReaction(row: DbReactionRow): ReactionRecord {
  return {
    id: row.id,
    contentItemId: row.content_item_id,
    reactionType: row.reaction_type,
    actorUserId: row.actor_user_id,
    actorFingerprint: row.actor_fingerprint,
    createdAt: row.created_at,
  };
}

function getPublishedAtForStatus({
  requested,
  previous,
  status,
  now,
}: {
  requested?: string;
  previous?: string | null;
  status: ContentStatus;
  now: string;
}) {
  if (requested) {
    return new Date(requested).toISOString();
  }

  if (status === "published") {
    return previous ?? now;
  }

  return previous ?? now;
}

function isResolvedSourceChannel(
  value: ResolvedSourceChannel | null,
): value is ResolvedSourceChannel {
  return value !== null;
}

export class SupabaseContentRepository implements ContentRepository {
  async listTaxonomy() {
    const client = ensureClient();

    const [categoriesResult, seriesResult, platformsResult, tagsResult] = await Promise.all([
      client.from("categories").select("id, slug, title, description").order("title"),
      client
        .from("series")
        .select("id, slug, category_id, title, description")
        .order("title"),
      client.from("platforms").select("id, slug, title, kind, base_url").order("title"),
      client.from("tags").select("id, slug, label").order("label"),
    ]);

    if (categoriesResult.error) throw categoriesResult.error;
    if (seriesResult.error) throw seriesResult.error;
    if (platformsResult.error) throw platformsResult.error;
    if (tagsResult.error) throw tagsResult.error;

    return {
      categories: (categoriesResult.data ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description ?? "",
      })),
      series: (seriesResult.data ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        categoryId: row.category_id,
        title: row.title,
        description: row.description ?? "",
      })),
      platforms: (platformsResult.data ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        kind: row.kind,
        baseUrl: row.base_url,
      })),
      tags: tagsResult.data ?? [],
    };
  }

  private async listItemsByCondition(condition?: {
    field: string;
    value: string;
  }) {
    const client = ensureClient();
    const taxonomy = await this.listTaxonomy();

    let query = client.from("content_items").select("*");
    if (condition) {
      query = query.eq(condition.field, condition.value);
    }

    const itemsResult = await query.order("published_at", { ascending: false });
    if (itemsResult.error) throw itemsResult.error;

    const itemRows = (itemsResult.data ?? []) as DbContentItemRow[];
    if (itemRows.length === 0) {
      return [];
    }

    const itemIds = itemRows.map((row) => row.id);

    const [linksResult, tagsResult] = await Promise.all([
      client
        .from("external_links")
        .select("id, content_item_id, link_kind, label, url, is_primary")
        .in("content_item_id", itemIds),
      client
        .from("content_item_tags")
        .select("content_item_id, tag_id")
        .in("content_item_id", itemIds),
    ]);

    if (linksResult.error) throw linksResult.error;
    if (tagsResult.error) throw tagsResult.error;

    const linksByItem = new Map<string, DbExternalLinkRow[]>();
    const tagIdsByItem = new Map<string, string[]>();

    for (const row of (linksResult.data ?? []) as DbExternalLinkRow[]) {
      const next = linksByItem.get(row.content_item_id) ?? [];
      next.push(row);
      linksByItem.set(row.content_item_id, next);
    }

    for (const row of (tagsResult.data ?? []) as DbContentItemTagRow[]) {
      const next = tagIdsByItem.get(row.content_item_id) ?? [];
      next.push(row.tag_id);
      tagIdsByItem.set(row.content_item_id, next);
    }

    const mappedItems = itemRows.map((row) =>
      rowToContentItem(row, linksByItem.get(row.id) ?? [], tagIdsByItem.get(row.id) ?? []),
    );

    return resolveContentItems(mappedItems, taxonomy);
  }

  async listArchiveItems() {
    const allItems = await this.listItemsByCondition({ field: "status", value: "published" });
    return sortItemsByDate(allItems, "newest");
  }

  async listAdminContentItems() {
    const allItems = await this.listItemsByCondition();
    return sortItemsByDate(allItems, "newest");
  }

  async getItemBySlug(slug: string) {
    const items = await this.listArchiveItems();
    return items.find((item) => item.slug === slug) ?? null;
  }

  async getAdminItemById(id: string) {
    const items = await this.listAdminContentItems();
    return items.find((item) => item.id === id) ?? null;
  }

  async createManualContentItem(input: CreateManualContentInput) {
    const client = ensureClient();
    const now = new Date().toISOString();
    const taxonomy = await this.listTaxonomy();

    const category = taxonomy.categories.find((entry) => entry.slug === input.categorySlug);
    if (!category) throw new Error("Категория не найдена");

    const platform = taxonomy.platforms.find((entry) => entry.slug === input.platformSlug);
    if (!platform) throw new Error("Платформа не найдена");

    const series = input.seriesSlug
      ? taxonomy.series.find((entry) => entry.slug === input.seriesSlug)
      : null;
    if (input.seriesSlug && !series) throw new Error("Серия не найдена");
    if (series && series.categoryId !== category.id) {
      throw new Error("Серия не принадлежит выбранной категории");
    }

    const duplicateCheck = await client
      .from("content_items")
      .select("id")
      .eq("slug", input.slug)
      .limit(1)
      .maybeSingle();
    if (duplicateCheck.error) throw duplicateCheck.error;
    if (duplicateCheck.data?.id) throw new Error("Слаг уже существует");

    const sourceResult = await client
      .from("content_sources")
      .insert({
        source_type: "manual",
        import_status: "not_applicable",
        external_source_id: null,
        source_payload: null,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (sourceResult.error) throw sourceResult.error;

    const itemResult = await client
      .from("content_items")
      .insert({
        slug: input.slug,
        title: input.title,
        category_id: category.id,
        series_id: series?.id ?? null,
        platform_id: platform.id,
        source_type: "manual",
        content_source_id: sourceResult.data.id,
        external_source_id: null,
        import_status: "not_applicable",
        status: input.status,
        moderation_status: "clean",
        published_at: getPublishedAtForStatus({
          requested: input.publishedAt,
          previous: null,
          status: input.status,
          now,
        }),
        created_at: now,
        updated_at: now,
        duration_minutes: 0,
        excerpt: input.excerpt,
        description: input.description,
        body: input.body ?? null,
        cover: {
          kind: "gradient",
          alt: input.title,
          palette: ["#1D4ED8", "#0F172A"],
        },
        source_payload: null,
        featured: false,
      })
      .select("id, slug")
      .single();
    if (itemResult.error) throw itemResult.error;

    const linkResult = await client.from("external_links").insert({
      content_item_id: itemResult.data.id,
      link_kind: platform.slug === "youtube" ? "youtube" : "video",
      label: "Открыть оригинал",
      url: ensureValidUrl(input.externalUrl),
      is_primary: true,
      created_at: now,
    });
    if (linkResult.error) throw linkResult.error;

    return { id: itemResult.data.id, slug: itemResult.data.slug };
  }

  async updateContentItem(input: UpdateContentItemInput) {
    const client = ensureClient();
    const now = new Date().toISOString();
    const taxonomy = await this.listTaxonomy();

    const category = taxonomy.categories.find((entry) => entry.slug === input.categorySlug);
    if (!category) throw new Error("Категория не найдена");
    const platform = taxonomy.platforms.find((entry) => entry.slug === input.platformSlug);
    if (!platform) throw new Error("Платформа не найдена");
    const series = input.seriesSlug
      ? taxonomy.series.find((entry) => entry.slug === input.seriesSlug)
      : null;
    if (input.seriesSlug && !series) throw new Error("Серия не найдена");
    if (series && series.categoryId !== category.id) {
      throw new Error("Серия не принадлежит выбранной категории");
    }

    const duplicateCheck = await client
      .from("content_items")
      .select("id")
      .eq("slug", input.slug)
      .neq("id", input.id)
      .limit(1)
      .maybeSingle();
    if (duplicateCheck.error) throw duplicateCheck.error;
    if (duplicateCheck.data?.id) throw new Error("Слаг уже используется другой записью");

    const existingItemResult = await client
      .from("content_items")
      .select("published_at")
      .eq("id", input.id)
      .single();
    if (existingItemResult.error) throw existingItemResult.error;

    const itemResult = await client
      .from("content_items")
      .update({
        title: input.title,
        slug: input.slug,
        excerpt: input.excerpt,
        description: input.description,
        body: input.body ?? null,
        category_id: category.id,
        series_id: series?.id ?? null,
        platform_id: platform.id,
        status: input.status,
        published_at: getPublishedAtForStatus({
          requested: input.publishedAt,
          previous: existingItemResult.data.published_at,
          status: input.status,
          now,
        }),
        updated_at: now,
      })
      .eq("id", input.id)
      .select("id, slug")
      .single();
    if (itemResult.error) throw itemResult.error;

    const externalUrl = ensureValidUrl(input.externalUrl);
    const existingPrimaryLink = await client
      .from("external_links")
      .select("id")
      .eq("content_item_id", input.id)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();
    if (existingPrimaryLink.error) throw existingPrimaryLink.error;

    if (existingPrimaryLink.data?.id) {
      const updateLink = await client
        .from("external_links")
        .update({
          url: externalUrl,
          label: "Открыть оригинал",
          link_kind: platform.slug === "youtube" ? "youtube" : "video",
        })
        .eq("id", existingPrimaryLink.data.id);
      if (updateLink.error) throw updateLink.error;
    } else {
      const insertLink = await client.from("external_links").insert({
        content_item_id: input.id,
        link_kind: platform.slug === "youtube" ? "youtube" : "video",
        label: "Открыть оригинал",
        url: externalUrl,
        is_primary: true,
        created_at: now,
      });
      if (insertLink.error) throw insertLink.error;
    }

    return {
      id: itemResult.data.id,
      slug: itemResult.data.slug,
    };
  }

  async setContentItemStatus(id: string, status: ContentStatus) {
    const client = ensureClient();
    const now = new Date().toISOString();

    const currentResult = await client
      .from("content_items")
      .select("published_at")
      .eq("id", id)
      .single();
    if (currentResult.error) throw currentResult.error;

    const result = await client
      .from("content_items")
      .update({
        status,
        updated_at: now,
        published_at:
          status === "published"
            ? currentResult.data.published_at ?? now
            : currentResult.data.published_at ?? now,
      })
      .eq("id", id)
      .select("id")
      .single();
    if (result.error) throw result.error;

    return { id: result.data.id, status };
  }

  async listCommentsForContentItem(
    contentItemId: string,
    options?: { statuses?: CommentStatus[] },
  ) {
    const client = ensureClient();

    let query = client
      .from("comments")
      .select(
        "id, content_item_id, parent_id, identity_mode, author_user_id, author_display, author_fingerprint, body, status, moderation_status, moderation_reason, created_at, updated_at",
      )
      .eq("content_item_id", contentItemId);

    if (options?.statuses && options.statuses.length > 0) {
      query = query.in("status", options.statuses);
    }

    const result = await query.order("created_at", { ascending: true });
    if (result.error) throw result.error;

    return ((result.data ?? []) as DbCommentRow[]).map(rowToComment);
  }

  async createComment(input: CreateCommentInput) {
    const client = ensureClient();
    const now = new Date().toISOString();

    const result = await client
      .from("comments")
      .insert({
        content_item_id: input.contentItemId,
        parent_id: null,
        identity_mode: input.identityMode,
        author_user_id: input.authorUserId ?? null,
        author_display: input.authorDisplay.trim(),
        author_fingerprint: input.authorFingerprint.trim(),
        body: input.body.trim(),
        status: "pending",
        moderation_status: "pending_review",
        moderation_reason: "Ожидает первичной модерации.",
        created_at: now,
        updated_at: now,
      })
      .select(
        "id, content_item_id, parent_id, identity_mode, author_user_id, author_display, author_fingerprint, body, status, moderation_status, moderation_reason, created_at, updated_at",
      )
      .single();

    if (result.error) throw result.error;
    return rowToComment(result.data as DbCommentRow);
  }

  async setCommentModeration(input: UpdateCommentModerationInput) {
    const client = ensureClient();

    const moderationStatus: ModerationStatus =
      input.status === "approved"
        ? "clean"
        : input.status === "pending"
          ? "pending_review"
          : "blocked";

    const result = await client
      .from("comments")
      .update({
        status: input.status,
        moderation_status: moderationStatus,
        moderation_reason: input.moderationReason?.trim() || null,
      })
      .eq("id", input.commentId)
      .select(
        "id, content_item_id, parent_id, identity_mode, author_user_id, author_display, author_fingerprint, body, status, moderation_status, moderation_reason, created_at, updated_at",
      )
      .single();

    if (result.error) throw result.error;
    return rowToComment(result.data as DbCommentRow);
  }

  async listModerationComments(filters?: {
    status?: CommentStatus | "all";
    q?: string;
    limit?: number;
  }) {
    const client = ensureClient();
    const status = filters?.status ?? "all";
    const q = (filters?.q ?? "").trim();
    const limit = filters?.limit ?? 150;

    let query = client
      .from("comments")
      .select(
        "id, content_item_id, parent_id, identity_mode, author_user_id, author_display, author_fingerprint, body, status, moderation_status, moderation_reason, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (q) {
      const escaped = q.replace(/,/g, " ");
      query = query.or(`author_display.ilike.%${escaped}%,body.ilike.%${escaped}%`);
    }

    const result = await query;
    if (result.error) throw result.error;
    return ((result.data ?? []) as DbCommentRow[]).map(rowToComment);
  }

  async listReactionsForContentItem(contentItemId: string) {
    const client = ensureClient();
    const result = await client
      .from("reactions")
      .select("id, content_item_id, reaction_type, actor_user_id, actor_fingerprint, created_at")
      .eq("content_item_id", contentItemId);

    if (result.error) throw result.error;
    return ((result.data ?? []) as DbReactionRow[]).map(rowToReaction);
  }

  async upsertReaction(input: UpsertReactionInput): Promise<UpsertReactionResult> {
    const client = ensureClient();
    const actorFingerprint = input.actorFingerprint.trim();
    if (!actorFingerprint) {
      throw new Error("Temporary identity fingerprint is required for reactions.");
    }

    const existingResult = await client
      .from("reactions")
      .select("id, content_item_id, reaction_type, actor_user_id, actor_fingerprint, created_at")
      .eq("content_item_id", input.contentItemId)
      .or(
        input.actorUserId
          ? `actor_user_id.eq.${input.actorUserId},actor_fingerprint.eq.${actorFingerprint}`
          : `actor_fingerprint.eq.${actorFingerprint}`,
      );
    if (existingResult.error) throw existingResult.error;

    const existing = (existingResult.data ?? []) as DbReactionRow[];
    const hasSame = existing.some((row) => row.reaction_type === input.reactionType);

    if (hasSame) {
      const deleteResult = await client
        .from("reactions")
        .delete()
        .eq("content_item_id", input.contentItemId)
        .or(
          input.actorUserId
            ? `actor_user_id.eq.${input.actorUserId},actor_fingerprint.eq.${actorFingerprint}`
            : `actor_fingerprint.eq.${actorFingerprint}`,
        );
      if (deleteResult.error) throw deleteResult.error;
      return {
        action: "removed",
        reaction: null,
      };
    }

    if (existing.length > 0) {
      const deleteResult = await client
        .from("reactions")
        .delete()
        .eq("content_item_id", input.contentItemId)
        .or(
          input.actorUserId
            ? `actor_user_id.eq.${input.actorUserId},actor_fingerprint.eq.${actorFingerprint}`
            : `actor_fingerprint.eq.${actorFingerprint}`,
        );
      if (deleteResult.error) throw deleteResult.error;
    }

    const insertResult = await client
      .from("reactions")
      .insert({
        content_item_id: input.contentItemId,
        reaction_type: input.reactionType,
        actor_user_id: input.actorUserId ?? null,
        actor_fingerprint: actorFingerprint,
        created_at: new Date().toISOString(),
      })
      .select("id, content_item_id, reaction_type, actor_user_id, actor_fingerprint, created_at")
      .single();
    if (insertResult.error) throw insertResult.error;

    return {
      action: existing.length > 0 ? "updated" : "created",
      reaction: rowToReaction(insertResult.data as DbReactionRow),
    };
  }

  async listSourceChannels() {
    const client = ensureClient();
    const taxonomy = await this.listTaxonomy();
    const platformMap = new Map(taxonomy.platforms.map((platform) => [platform.id, platform]));

    const result = await client
      .from("source_channels")
      .select(
        "id, slug, title, platform_id, external_channel_id, source_url, is_active, notes, last_synced_at, last_successful_sync_at, last_error_at, last_error_message, created_at, updated_at",
      )
      .order("title");

    if (result.error) throw result.error;

    const channels = (result.data ?? []) as DbSourceChannelRow[];
    return channels
      .map((row): ResolvedSourceChannel | null => {
        const platform = platformMap.get(row.platform_id);
        if (!platform) return null;

        const channel: SourceChannel = {
          id: row.id,
          slug: row.slug,
          title: row.title,
          platformId: row.platform_id,
          externalChannelId: row.external_channel_id,
          sourceUrl: row.source_url,
          isActive: row.is_active ?? true,
          notes: row.notes,
          lastSyncedAt: row.last_synced_at,
          lastSuccessfulSyncAt: row.last_successful_sync_at,
          lastErrorAt: row.last_error_at,
          lastErrorMessage: row.last_error_message,
          createdAt: row.created_at ?? undefined,
          updatedAt: row.updated_at ?? undefined,
        };

        return {
          ...channel,
          platform,
        };
      })
      .filter(isResolvedSourceChannel);
  }

  async createSourceChannel(input: CreateSourceChannelInput) {
    const client = ensureClient();
    const taxonomy = await this.listTaxonomy();
    const now = new Date().toISOString();

    const platform = taxonomy.platforms.find((entry) => entry.slug === input.platformSlug);
    if (!platform) throw new Error("Платформа не найдена");

    const sourceUrl = input.sourceUrl?.trim() ? ensureValidUrl(input.sourceUrl) : null;
    const externalChannelId = input.externalChannelId?.trim() || null;
    if (!sourceUrl && !externalChannelId) {
      throw new Error("Укажите URL канала или внешний channel id");
    }

    const duplicate = await client
      .from("source_channels")
      .select("id")
      .eq("slug", input.slug)
      .limit(1)
      .maybeSingle();
    if (duplicate.error) throw duplicate.error;
    if (duplicate.data?.id) throw new Error("Канал с таким slug уже существует");

    const result = await client
      .from("source_channels")
      .insert({
        slug: input.slug,
        title: input.title,
        platform_id: platform.id,
        external_channel_id: externalChannelId,
        source_url: sourceUrl,
        is_active: input.isActive,
        notes: input.notes?.trim() || null,
        last_synced_at: null,
        last_successful_sync_at: null,
        last_error_at: null,
        last_error_message: null,
        created_at: now,
        updated_at: now,
      })
      .select("id, slug")
      .single();

    if (result.error) throw result.error;
    return { id: result.data.id, slug: result.data.slug };
  }

  async runSourceSync(
    sourceId: string,
    options?: {
      trigger?: ImportRunTrigger;
      parentRunId?: string;
      requestKey?: string;
      lockAcquiredAt?: string;
      lockReleasedAt?: string;
    },
  ): Promise<ImportRun> {
    void sourceId;
    void options;
    throw new Error(
      "Supabase ingestion path is not active in this phase runtime. Fallback repository will be used.",
    );
  }

  async runAllActiveSourceSync(options?: { requestKey?: string }): Promise<ImportRun[]> {
    void options;
    throw new Error(
      "Supabase ingestion path is not active in this phase runtime. Fallback repository will be used.",
    );
  }

  async getImportRunById(id: string): Promise<ImportRun | null> {
    void id;
    throw new Error(
      "Supabase ingestion path is not active in this phase runtime. Fallback repository will be used.",
    );
  }

  async listImportRuns(limit?: number): Promise<ImportRun[]> {
    void limit;
    throw new Error(
      "Supabase ingestion path is not active in this phase runtime. Fallback repository will be used.",
    );
  }
}
