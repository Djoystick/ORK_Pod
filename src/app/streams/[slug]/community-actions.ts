"use server";

import { revalidatePath } from "next/cache";

import { assertCommunityWriteAccess } from "@/server/auth/community-gate";
import { resolveCommunityIdentityForWrite } from "@/server/auth/community-identity";
import { getContentRepository } from "@/server/repositories/content-repository";
import { consumeWriteRateLimit } from "@/server/security/write-rate-limit";
import {
  createCommentForPublicContent,
  setReactionForPublicContent,
} from "@/server/services/community-service";
import type { ReactionType } from "@/types/content";

export type CommunityCommentActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type CommunityReactionActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Операция не выполнена.";
}

function parseReactionType(value: string): ReactionType {
  if (value === "like" || value === "love" || value === "insight" || value === "fire") {
    return value;
  }
  throw new Error("Неизвестный тип реакции.");
}

async function resolvePublishedItemIdBySlug(slug: string) {
  const repository = getContentRepository();
  const item = await repository.getItemBySlug(slug);
  if (!item) {
    throw new Error("Запись не найдена или недоступна.");
  }
  return item.id;
}

export async function addCommentAction(
  _prevState: CommunityCommentActionState,
  formData: FormData,
): Promise<CommunityCommentActionState> {
  try {
    const slug = String(formData.get("slug") ?? "").trim();
    const body = String(formData.get("body") ?? "").trim();
    const displayName = String(formData.get("displayName") ?? "").trim();
    const honeypot = String(formData.get("website") ?? "").trim();
    if (!slug || !body) {
      throw new Error("Заполните текст комментария.");
    }
    if (honeypot) {
      throw new Error("Комментарий отклонен фильтром безопасности.");
    }

    const contentItemId = await resolvePublishedItemIdBySlug(slug);
    const writeContext = await assertCommunityWriteAccess();
    const preferredName =
      displayName || writeContext.principal?.email?.split("@")[0] || undefined;
    const identity = await resolveCommunityIdentityForWrite({
      writeContext,
      preferredDisplayName: preferredName,
    });
    const limit = await consumeWriteRateLimit({
      scope: "comment_create",
      actorKey: `${identity.fingerprint}:${contentItemId}`,
      windowMs: 10 * 60 * 1000,
      maxHits: 3,
    });
    if (!limit.allowed) {
      throw new Error("Слишком много комментариев за короткое время. Попробуйте позже.");
    }

    await createCommentForPublicContent({
      contentItemId,
      body,
      identity,
      authorUserId: writeContext.principal?.userId ?? null,
    });

    revalidatePath(`/streams/${slug}`);
    revalidatePath("/admin/moderation");

    return {
      status: "success",
      message: "Комментарий отправлен и ожидает модерации.",
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error),
    };
  }
}

export async function setReactionAction(
  _prevState: CommunityReactionActionState,
  formData: FormData,
): Promise<CommunityReactionActionState> {
  try {
    const slug = String(formData.get("slug") ?? "").trim();
    const reactionType = parseReactionType(String(formData.get("reactionType") ?? "").trim());
    if (!slug) {
      throw new Error("Не передан slug записи.");
    }

    const contentItemId = await resolvePublishedItemIdBySlug(slug);
    const writeContext = await assertCommunityWriteAccess();
    const identity = await resolveCommunityIdentityForWrite({
      writeContext,
    });
    const limit = await consumeWriteRateLimit({
      scope: "reaction_write",
      actorKey: `${identity.fingerprint}:${contentItemId}`,
      windowMs: 5 * 60 * 1000,
      maxHits: 40,
    });
    if (!limit.allowed) {
      throw new Error("Слишком частые реакции. Подождите немного.");
    }
    const result = await setReactionForPublicContent({
      contentItemId,
      reactionType,
      identity,
      actorUserId: writeContext.principal?.userId ?? null,
    });

    revalidatePath(`/streams/${slug}`);

    const actionMessage =
      result.action === "removed"
        ? "Реакция снята."
        : result.action === "updated"
          ? "Реакция обновлена."
          : "Реакция добавлена.";

    return {
      status: "success",
      message: actionMessage,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error),
    };
  }
}
