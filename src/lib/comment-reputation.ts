import type {
  CommentAuthorReputation,
  CommentStatus,
  CommentTrustDecision,
  ModerationStatus,
} from "@/types/content";

export function calculateCommentReputationCoefficient(totalPositive: number, totalNegative: number) {
  const safePositive = Math.max(0, Math.floor(totalPositive));
  const safeNegative = Math.max(0, Math.floor(totalNegative));
  const coefficient = (safePositive + 1) / (safeNegative + 1);
  return Number(coefficient.toFixed(3));
}

export function buildCommentAuthorReputation(input: {
  totalPositive: number;
  totalNegative: number;
  totalComments: number;
  ratedComments: number;
}): CommentAuthorReputation {
  const totalPositive = Math.max(0, Math.floor(input.totalPositive));
  const totalNegative = Math.max(0, Math.floor(input.totalNegative));
  const totalComments = Math.max(0, Math.floor(input.totalComments));
  const ratedComments = Math.max(0, Math.floor(input.ratedComments));
  const totalVotes = totalPositive + totalNegative;
  const coefficient = calculateCommentReputationCoefficient(totalPositive, totalNegative);

  const signal: CommentAuthorReputation["signal"] =
    totalVotes >= 10 ? "high" : totalVotes >= 3 ? "medium" : "low";

  return {
    coefficient,
    totalPositive,
    totalNegative,
    totalVotes,
    totalComments,
    ratedComments,
    signal,
  };
}

export function resolveCommentTrustModerationDecision(input: {
  coefficient: number;
}): {
  status: CommentStatus;
  moderationStatus: ModerationStatus;
  moderationReason: string;
  trustDecision: CommentTrustDecision;
} {
  const coefficient = Number.isFinite(input.coefficient)
    ? Number(input.coefficient.toFixed(3))
    : 1;

  if (coefficient > 1) {
    return {
      status: "approved",
      moderationStatus: "clean",
      moderationReason: `Автомодерация доверия: коэффициент автора ${coefficient.toFixed(3)} > 1, комментарий опубликован автоматически.`,
      trustDecision: "auto_publish",
    };
  }

  if (coefficient < 1) {
    return {
      status: "pending",
      moderationStatus: "pending_review",
      moderationReason: `Автомодерация доверия: коэффициент автора ${coefficient.toFixed(3)} < 1, комментарий отправлен на модерацию.`,
      trustDecision: "moderation_required",
    };
  }

  return {
    status: "pending",
    moderationStatus: "pending_review",
    moderationReason:
      "Автомодерация доверия: коэффициент автора равен 1.000 (недостаточно подтверждённой репутации), комментарий отправлен на модерацию.",
    trustDecision: "neutral_pending",
  };
}
