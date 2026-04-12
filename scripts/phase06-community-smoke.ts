import { randomUUID } from "node:crypto";

import { getContentRepository } from "@/server/repositories/content-repository";

async function run() {
  const repository = getContentRepository();
  const archiveItems = await repository.listArchiveItems();
  const target = archiveItems[0];

  if (!target) {
    throw new Error("No published content item found for smoke test.");
  }

  const fingerprint = `smoke-${randomUUID()}`;
  const comment = await repository.createComment({
    contentItemId: target.id,
    authorDisplay: "Smoke Tester",
    authorFingerprint: fingerprint,
    body: "Phase 06 smoke comment",
    identityMode: "guest_cookie_v1",
  });

  const approvedBefore = await repository.listCommentsForContentItem(target.id, {
    statuses: ["approved"],
  });

  await repository.setCommentModeration({
    commentId: comment.id,
    status: "approved",
    moderationReason: "smoke approve",
  });
  const approvedAfterApprove = await repository.listCommentsForContentItem(target.id, {
    statuses: ["approved"],
  });

  await repository.setCommentModeration({
    commentId: comment.id,
    status: "hidden",
    moderationReason: "smoke hide",
  });
  const approvedAfterHide = await repository.listCommentsForContentItem(target.id, {
    statuses: ["approved"],
  });

  const reactionCreated = await repository.upsertReaction({
    contentItemId: target.id,
    actorFingerprint: fingerprint,
    reactionType: "like",
  });
  const reactionRemoved = await repository.upsertReaction({
    contentItemId: target.id,
    actorFingerprint: fingerprint,
    reactionType: "like",
  });
  const reactionCreatedAgain = await repository.upsertReaction({
    contentItemId: target.id,
    actorFingerprint: fingerprint,
    reactionType: "fire",
  });
  const reactionReplaced = await repository.upsertReaction({
    contentItemId: target.id,
    actorFingerprint: fingerprint,
    reactionType: "love",
  });

  const reactions = await repository.listReactionsForContentItem(target.id);
  const actorReactions = reactions.filter((reaction) => reaction.actorFingerprint === fingerprint);

  const summary = {
    targetSlug: target.slug,
    pendingNotPublic: !approvedBefore.some((entry) => entry.id === comment.id),
    approvedVisible: approvedAfterApprove.some((entry) => entry.id === comment.id),
    hiddenNotPublic: !approvedAfterHide.some((entry) => entry.id === comment.id),
    reactionFlow: {
      first: reactionCreated.action,
      second: reactionRemoved.action,
      third: reactionCreatedAgain.action,
      fourth: reactionReplaced.action,
      actorReactionCount: actorReactions.length,
      actorReactionType: actorReactions[0]?.reactionType ?? null,
    },
  };

  console.log(JSON.stringify(summary, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
