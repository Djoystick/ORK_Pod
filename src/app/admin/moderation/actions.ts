"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { setCommentModerationViaRepository } from "@/server/services/community-service";
import type { CommentStatus } from "@/types/content";

export type ModerationActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialModerationActionState: ModerationActionState = {
  status: "idle",
  message: "",
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Операция модерации не выполнена.";
}

function parseCommentStatus(value: string): CommentStatus {
  if (value === "approved" || value === "hidden" || value === "rejected") {
    return value;
  }
  return "pending";
}

export async function setCommentModerationAction(
  _prevState: ModerationActionState,
  formData: FormData,
): Promise<ModerationActionState> {
  try {
    const host = (await headers()).get("host") ?? "";
    const commentId = String(formData.get("commentId") ?? "").trim();
    const status = parseCommentStatus(String(formData.get("status") ?? "pending"));
    const moderationReason = String(formData.get("moderationReason") ?? "").trim() || undefined;
    const bootstrapKey = String(formData.get("bootstrapKey") ?? "").trim() || undefined;
    const contentSlug = String(formData.get("contentSlug") ?? "").trim();

    if (!commentId) {
      throw new Error("Не передан commentId.");
    }

    await setCommentModerationViaRepository({
      host,
      commentId,
      status,
      moderationReason,
      bootstrapKey,
    });

    revalidatePath("/admin");
    revalidatePath("/admin/moderation");
    if (contentSlug) {
      revalidatePath(`/streams/${contentSlug}`);
    }

    return {
      status: "success",
      message: `Статус комментария обновлен: ${status}`,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error),
    };
  }
}
