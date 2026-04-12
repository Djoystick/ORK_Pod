import "server-only";

import { assertAdminWriteAccess, resolveAdminGateContext } from "@/server/auth/admin-gate";
import { resolveCommunityWriteContext } from "@/server/auth/community-gate";
import type { CommunityIdentityContext } from "@/server/auth/community-identity";
import { getContentRepository } from "@/server/repositories/content-repository";
import type {
  CommentStatus,
  CommunityReactionSummary,
  ReactionRecord,
  ReactionType,
} from "@/types/content";

const reactionTypes: ReactionType[] = ["like", "love", "insight", "fire"];

function buildReactionSummary(
  reactions: ReactionRecord[],
  viewerFingerprint?: string | null,
): CommunityReactionSummary {
  const counts = new Map<ReactionType, number>();
  for (const type of reactionTypes) {
    counts.set(type, 0);
  }

  for (const reaction of reactions) {
    counts.set(reaction.reactionType, (counts.get(reaction.reactionType) ?? 0) + 1);
  }

  const activeReaction =
    reactions.find(
      (reaction) =>
        Boolean(viewerFingerprint) && reaction.actorFingerprint === viewerFingerprint,
    )?.reactionType ?? null;

  return {
    total: reactions.length,
    activeReactionType: activeReaction,
    items: reactionTypes.map((reactionType) => ({
      reactionType,
      count: counts.get(reactionType) ?? 0,
      reactedByCurrentUser: activeReaction === reactionType,
    })),
  };
}

export async function getPublicCommunityData(
  contentItemId: string,
  viewerFingerprint?: string | null,
) {
  const repository = getContentRepository();
  const [comments, reactions, writeContext] = await Promise.all([
    repository.listCommentsForContentItem(contentItemId, { statuses: ["approved"] }),
    repository.listReactionsForContentItem(contentItemId),
    resolveCommunityWriteContext(),
  ]);

  return {
    comments,
    reactionSummary: buildReactionSummary(reactions, viewerFingerprint),
    policy: {
      identityMode: "guest_cookie_v1" as const,
      commentModeration: "pending_by_default" as const,
      canWrite: writeContext.canWrite,
      writeMode: writeContext.mode,
      requiresAuth: writeContext.requiresAuth,
      message: writeContext.canWrite
        ? `${writeContext.message} Комментарии публикуются после модерации.`
        : `${writeContext.message} Read-only режим включен для community блока.`,
    },
  };
}

export async function createCommentForPublicContent(params: {
  contentItemId: string;
  body: string;
  identity: CommunityIdentityContext;
  authorUserId?: string | null;
}) {
  const repository = getContentRepository();
  return repository.createComment({
    contentItemId: params.contentItemId,
    authorUserId: params.authorUserId ?? null,
    authorDisplay: params.identity.displayName,
    authorFingerprint: params.identity.fingerprint,
    body: params.body,
    identityMode: params.identity.mode,
  });
}

export async function setReactionForPublicContent(params: {
  contentItemId: string;
  reactionType: ReactionType;
  identity: CommunityIdentityContext;
  actorUserId?: string | null;
}) {
  const repository = getContentRepository();
  return repository.upsertReaction({
    contentItemId: params.contentItemId,
    reactionType: params.reactionType,
    actorUserId: params.actorUserId ?? null,
    actorFingerprint: params.identity.fingerprint,
  });
}

function parseModerationStatus(value: string): CommentStatus | "all" {
  if (value === "approved" || value === "hidden" || value === "rejected" || value === "pending") {
    return value;
  }
  return "all";
}

export async function getAdminModerationData(
  host: string,
  filters: {
    status?: string;
    q?: string;
  },
) {
  const gate = await resolveAdminGateContext(host);
  const normalizedFilters = {
    status: parseModerationStatus(filters.status ?? "pending"),
    q: (filters.q ?? "").trim(),
  };

  if (!gate.canAccessAdmin) {
    return {
      gate,
      filters: normalizedFilters,
      comments: [],
      summary: {
        total: 0,
        pending: 0,
        approved: 0,
        hidden: 0,
        rejected: 0,
      },
    };
  }

  const repository = getContentRepository();
  const [comments, contentItems] = await Promise.all([
    repository.listModerationComments({
      status: normalizedFilters.status,
      q: normalizedFilters.q,
      limit: 200,
    }),
    repository.listAdminContentItems(),
  ]);

  const itemMap = new Map(
    contentItems.map((item) => [
      item.id,
      {
        title: item.title,
        slug: item.slug,
        status: item.status ?? "draft",
      },
    ]),
  );

  const linkedComments = comments.map((comment) => {
    const item = itemMap.get(comment.contentItemId);
    return {
      ...comment,
      contentTitle: item?.title ?? "Unknown content",
      contentSlug: item?.slug ?? null,
      contentStatus: item?.status ?? "draft",
    };
  });

  return {
    gate,
    filters: normalizedFilters,
    comments: linkedComments,
    summary: {
      total: linkedComments.length,
      pending: linkedComments.filter((comment) => comment.status === "pending").length,
      approved: linkedComments.filter((comment) => comment.status === "approved").length,
      hidden: linkedComments.filter((comment) => comment.status === "hidden").length,
      rejected: linkedComments.filter((comment) => comment.status === "rejected").length,
    },
  };
}

export async function setCommentModerationViaRepository(params: {
  host: string;
  commentId: string;
  status: CommentStatus;
  moderationReason?: string;
  bootstrapKey?: string;
}) {
  await assertAdminWriteAccess({
    host: params.host,
    providedKey: params.bootstrapKey,
  });

  const repository = getContentRepository();
  return repository.setCommentModeration({
    commentId: params.commentId,
    status: params.status,
    moderationReason: params.moderationReason,
  });
}
