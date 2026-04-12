import "server-only";

import { resolveCommentTrustModerationDecision } from "@/lib/comment-reputation";
import { assertAdminWriteAccess, resolveAdminGateContext } from "@/server/auth/admin-gate";
import { buildSupabaseActorFingerprint } from "@/server/auth/community-identity";
import { resolveCommunityWriteContext } from "@/server/auth/community-gate";
import type { CommunityIdentityContext } from "@/server/auth/community-identity";
import { getContentRepository } from "@/server/repositories/content-repository";
import type {
  CommentAuthorReputation,
  CommentFeedbackRecord,
  CommentFeedbackSummary,
  CommentFeedbackType,
  CommentStatus,
  CommunityReactionSummary,
  ReactionRecord,
  ReactionType,
} from "@/types/content";

const reactionTypes: ReactionType[] = ["like", "love", "insight", "fire"];

function buildReactionSummary(
  reactions: ReactionRecord[],
  viewer: {
    fingerprint?: string | null;
    userId?: string | null;
  },
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
        (Boolean(viewer.userId) && reaction.actorUserId === viewer.userId) ||
        (Boolean(viewer.fingerprint) && reaction.actorFingerprint === viewer.fingerprint),
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

function buildCommentFeedbackSummary(params: {
  feedback: CommentFeedbackRecord[];
  viewer: {
    fingerprint?: string | null;
    userId?: string | null;
  };
}): CommentFeedbackSummary {
  const up = params.feedback.filter((entry) => entry.feedbackType === "up").length;
  const down = params.feedback.filter((entry) => entry.feedbackType === "down").length;
  const activeFeedbackType =
    params.feedback.find(
      (entry) =>
        (Boolean(params.viewer.userId) && entry.actorUserId === params.viewer.userId) ||
        (Boolean(params.viewer.fingerprint) && entry.actorFingerprint === params.viewer.fingerprint),
    )?.feedbackType ?? null;

  return {
    total: params.feedback.length,
    up,
    down,
    score: up - down,
    activeFeedbackType,
  };
}

function buildAuthorReputationKey(input: {
  authorUserId?: string | null;
  authorFingerprint?: string | null;
}) {
  const authorUserId = input.authorUserId?.trim() ?? "";
  if (authorUserId) {
    return `user:${authorUserId}`;
  }

  const authorFingerprint = input.authorFingerprint?.trim() ?? "";
  if (authorFingerprint) {
    return `fingerprint:${authorFingerprint}`;
  }

  return null;
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
  const viewer =
    writeContext.mode === "supabase_auth_required" && writeContext.principal
      ? {
          fingerprint: buildSupabaseActorFingerprint(writeContext.principal.userId),
          userId: writeContext.principal.userId,
        }
      : {
          fingerprint: viewerFingerprint,
          userId: null,
        };

  const commentFeedback = await repository.listCommentFeedbackForCommentIds(
    comments.map((comment) => comment.id),
  );
  const feedbackByCommentId = new Map<string, CommentFeedbackRecord[]>();
  for (const entry of commentFeedback) {
    const list = feedbackByCommentId.get(entry.commentId) ?? [];
    list.push(entry);
    feedbackByCommentId.set(entry.commentId, list);
  }

  return {
    comments: comments.map((comment) => ({
      ...comment,
      feedbackSummary: buildCommentFeedbackSummary({
        feedback: feedbackByCommentId.get(comment.id) ?? [],
        viewer,
      }),
    })),
    reactionSummary: buildReactionSummary(reactions, viewer),
    policy: {
      identityMode: "guest_cookie_v1" as const,
      commentModeration: "trust_score_v1" as const,
      canWrite: writeContext.canWrite,
      writeMode: writeContext.mode,
      requiresAuth: writeContext.requiresAuth,
      message: writeContext.canWrite
        ? `${writeContext.message} Новые комментарии проходят trust-проверку: коэффициент автора > 1 публикуется сразу, иначе комментарий уходит на модерацию.`
        : `${writeContext.message} Для community-блока включён read-only режим.`,
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
  const reputation = await repository.getAuthorCommentReputation({
    authorUserId: params.authorUserId ?? null,
    authorFingerprint: params.identity.fingerprint,
  });
  const moderationDecision = resolveCommentTrustModerationDecision({
    coefficient: reputation.coefficient,
  });
  const created = await repository.createComment({
    contentItemId: params.contentItemId,
    authorUserId: params.authorUserId ?? null,
    authorDisplay: params.identity.displayName,
    authorFingerprint: params.identity.fingerprint,
    body: params.body,
    identityMode: params.identity.mode,
    initialStatus: moderationDecision.status,
    initialModerationStatus: moderationDecision.moderationStatus,
    initialModerationReason: moderationDecision.moderationReason,
    authorReputationCoefficient: reputation.coefficient,
    trustDecision: moderationDecision.trustDecision,
  });

  return {
    ...created,
    authorReputation: reputation,
  };
}

export async function setCommentFeedbackForPublicContent(params: {
  contentItemId: string;
  commentId: string;
  feedbackType: CommentFeedbackType;
  identity: CommunityIdentityContext;
  actorUserId?: string | null;
}) {
  const repository = getContentRepository();
  const comment = await repository.getCommentById(params.commentId);
  if (!comment || comment.contentItemId !== params.contentItemId) {
    throw new Error("Комментарий не найден в контексте этого материала.");
  }
  if (comment.status !== "approved") {
    throw new Error("Голосовать можно только за опубликованные комментарии.");
  }

  const isOwnComment =
    (Boolean(params.actorUserId) &&
      Boolean(comment.authorUserId) &&
      params.actorUserId === comment.authorUserId) ||
    params.identity.fingerprint === comment.authorFingerprint;
  if (isOwnComment) {
    throw new Error("Нельзя голосовать за собственный комментарий.");
  }

  return repository.upsertCommentFeedback({
    commentId: params.commentId,
    contentItemId: params.contentItemId,
    feedbackType: params.feedbackType,
    actorUserId: params.actorUserId ?? null,
    actorFingerprint: params.identity.fingerprint,
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

  const authorIdentityByKey = new Map<
    string,
    {
      authorUserId?: string | null;
      authorFingerprint?: string | null;
    }
  >();
  for (const comment of comments) {
    const key = buildAuthorReputationKey({
      authorUserId: comment.authorUserId,
      authorFingerprint: comment.authorFingerprint,
    });
    if (!key || authorIdentityByKey.has(key)) {
      continue;
    }

    authorIdentityByKey.set(key, {
      authorUserId: comment.authorUserId,
      authorFingerprint: comment.authorFingerprint,
    });
  }

  const reputationByKey = new Map<string, CommentAuthorReputation>();
  await Promise.all(
    Array.from(authorIdentityByKey.entries()).map(async ([key, identity]) => {
      const reputation = await repository.getAuthorCommentReputation(identity);
      reputationByKey.set(key, reputation);
    }),
  );

  const linkedComments = comments.map((comment) => {
    const item = itemMap.get(comment.contentItemId);
    const authorKey = buildAuthorReputationKey({
      authorUserId: comment.authorUserId,
      authorFingerprint: comment.authorFingerprint,
    });
    return {
      ...comment,
      contentTitle: item?.title ?? "Unknown content",
      contentSlug: item?.slug ?? null,
      contentStatus: item?.status ?? "draft",
      authorReputation: authorKey ? reputationByKey.get(authorKey) ?? null : null,
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
