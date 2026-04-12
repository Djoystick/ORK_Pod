import type { ResolvedContentItem } from "@/types/content";

type MappingConfidence = "high" | "medium" | "low";
type AutomationReviewState = "review_needed" | "review_light" | "auto_published";
type AutomationPublishDecision = "keep_draft" | "review_required" | "auto_publish";
type MetadataReliability = "high" | "medium" | "low";

export type PublishReadinessCheckKey =
  | "status_draft"
  | "title"
  | "slug"
  | "primary_link"
  | "description"
  | "cover"
  | "automation_confidence"
  | "automation_review"
  | "automation_publish_decision"
  | "automation_metadata_reliability";

export type PublishReadinessCheck = {
  key: PublishReadinessCheckKey;
  passed: boolean;
  message: string;
};

export type PublishReadinessResult = {
  isReady: boolean;
  checks: PublishReadinessCheck[];
  failedChecks: PublishReadinessCheck[];
  mappingConfidence: MappingConfidence | null;
  reviewState: AutomationReviewState | null;
  publishDecision: AutomationPublishDecision | null;
  metadataReliability: MetadataReliability | null;
};

function isHttpUrl(value: string | null | undefined) {
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function readMappingConfidence(item: ResolvedContentItem): MappingConfidence | null {
  const mapping =
    item.sourcePayload &&
    typeof item.sourcePayload === "object" &&
    (item.sourcePayload as Record<string, unknown>).mapping &&
    typeof (item.sourcePayload as Record<string, unknown>).mapping === "object"
      ? ((item.sourcePayload as Record<string, unknown>).mapping as Record<string, unknown>)
      : null;

  if (
    mapping?.confidence === "high" ||
    mapping?.confidence === "medium" ||
    mapping?.confidence === "low"
  ) {
    return mapping.confidence;
  }

  return null;
}

function readAutomationReviewState(item: ResolvedContentItem): AutomationReviewState | null {
  const automation =
    item.sourcePayload &&
    typeof item.sourcePayload === "object" &&
    (item.sourcePayload as Record<string, unknown>).automation &&
    typeof (item.sourcePayload as Record<string, unknown>).automation === "object"
      ? ((item.sourcePayload as Record<string, unknown>).automation as Record<string, unknown>)
      : null;

  if (
    automation?.reviewState === "review_needed" ||
    automation?.reviewState === "review_light" ||
    automation?.reviewState === "auto_published"
  ) {
    return automation.reviewState;
  }

  if (item.sourceType === "imported") {
    return "review_needed";
  }

  return null;
}

function readAutomationPublishDecision(
  item: ResolvedContentItem,
): AutomationPublishDecision | null {
  const automation =
    item.sourcePayload &&
    typeof item.sourcePayload === "object" &&
    (item.sourcePayload as Record<string, unknown>).automation &&
    typeof (item.sourcePayload as Record<string, unknown>).automation === "object"
      ? ((item.sourcePayload as Record<string, unknown>).automation as Record<string, unknown>)
      : null;

  if (
    automation?.publishDecision === "keep_draft" ||
    automation?.publishDecision === "review_required" ||
    automation?.publishDecision === "auto_publish"
  ) {
    return automation.publishDecision;
  }

  if (item.sourceType === "imported") {
    return "review_required";
  }

  return null;
}

function readMetadataReliability(item: ResolvedContentItem): MetadataReliability | null {
  const mapping =
    item.sourcePayload &&
    typeof item.sourcePayload === "object" &&
    (item.sourcePayload as Record<string, unknown>).mapping &&
    typeof (item.sourcePayload as Record<string, unknown>).mapping === "object"
      ? ((item.sourcePayload as Record<string, unknown>).mapping as Record<string, unknown>)
      : null;

  if (
    mapping?.metadataReliability === "high" ||
    mapping?.metadataReliability === "medium" ||
    mapping?.metadataReliability === "low"
  ) {
    return mapping.metadataReliability;
  }

  return null;
}

function hasUsableCover(item: ResolvedContentItem) {
  const hasImageCover = item.cover.kind === "image" && Boolean(item.cover.src?.trim());
  const hasGradientFallback =
    Array.isArray(item.cover.palette) &&
    item.cover.palette.length === 2 &&
    item.cover.palette.every((entry) => typeof entry === "string" && entry.trim().length > 0);

  return hasImageCover || hasGradientFallback;
}

function hasMeaningfulDescription(item: ResolvedContentItem) {
  const excerptLength = item.excerpt.trim().length;
  const descriptionLength = item.description.trim().length;
  const bodyLength = item.body?.trim().length ?? 0;

  return excerptLength >= 30 || descriptionLength >= 80 || bodyLength >= 120;
}

export function evaluatePublishReadiness(item: ResolvedContentItem): PublishReadinessResult {
  const mappingConfidence = readMappingConfidence(item);
  const reviewState = readAutomationReviewState(item);
  const publishDecision = readAutomationPublishDecision(item);
  const metadataReliability = readMetadataReliability(item);

  const checks: PublishReadinessCheck[] = [
    {
      key: "status_draft",
      passed: item.status === "draft",
      message: "Статус записи должен быть draft.",
    },
    {
      key: "title",
      passed: item.title.trim().length >= 8,
      message: "Нужен внятный заголовок (минимум 8 символов).",
    },
    {
      key: "slug",
      passed: item.slug.trim().length >= 4,
      message: "Нужен корректный slug (минимум 4 символа).",
    },
    {
      key: "primary_link",
      passed: isHttpUrl(item.primaryLink?.url ?? item.links[0]?.url ?? null),
      message: "Нужна рабочая primary external ссылка (http/https).",
    },
    {
      key: "description",
      passed: hasMeaningfulDescription(item),
      message: "Нужен непустой текст для карточки/деталей (excerpt/description/body).",
    },
    {
      key: "cover",
      passed: hasUsableCover(item),
      message: "Нужен usable cover (image или безопасный gradient fallback).",
    },
  ];

  if (item.sourceType === "imported") {
    checks.push(
      {
        key: "automation_confidence",
        passed: mappingConfidence === "high" || mappingConfidence === "medium",
        message: "Для imported требуется mapping confidence не ниже medium.",
      },
      {
        key: "automation_review",
        passed: reviewState === "review_light" || reviewState === "auto_published",
        message: "Для imported review state должен быть review_light/auto_published.",
      },
      {
        key: "automation_publish_decision",
        passed: publishDecision === "keep_draft" || publishDecision === "auto_publish",
        message: "Для imported publish decision не должен быть review_required.",
      },
      {
        key: "automation_metadata_reliability",
        passed: metadataReliability === "high" || metadataReliability === "medium",
        message: "Для imported metadata reliability должна быть не ниже medium.",
      },
    );
  }

  const failedChecks = checks.filter((check) => !check.passed);

  return {
    isReady: failedChecks.length === 0,
    checks,
    failedChecks,
    mappingConfidence,
    reviewState,
    publishDecision,
    metadataReliability,
  };
}
