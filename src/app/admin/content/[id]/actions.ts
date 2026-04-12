"use server";

import { headers } from "next/headers";

import {
  setContentStatusViaRepository,
  updateContentViaRepository,
} from "@/server/services/admin-content-service";
import type { ContentStatus } from "@/types/content";

export type UpdateContentActionState = {
  status: "idle" | "success" | "error";
  message: string;
  slug?: string;
};

export const initialUpdateContentActionState: UpdateContentActionState = {
  status: "idle",
  message: "",
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Операция не выполнена.";
}

export async function updateContentAction(
  _prevState: UpdateContentActionState,
  formData: FormData,
): Promise<UpdateContentActionState> {
  try {
    const host = (await headers()).get("host") ?? "";
    const updated = await updateContentViaRepository(formData, host);

    return {
      status: "success",
      message: "Изменения сохранены.",
      slug: updated.slug,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error),
    };
  }
}

function parseStatus(value: string): ContentStatus {
  if (value === "draft" || value === "archived") {
    return value;
  }

  return "published";
}

export async function setContentStatusAction(
  _prevState: UpdateContentActionState,
  formData: FormData,
): Promise<UpdateContentActionState> {
  try {
    const host = (await headers()).get("host") ?? "";
    const id = String(formData.get("id") ?? "").trim();
    const status = parseStatus(String(formData.get("status") ?? "draft"));
    const bootstrapKey = String(formData.get("bootstrapKey") ?? "").trim() || undefined;

    if (!id) {
      throw new Error("Не передан id записи.");
    }

    await setContentStatusViaRepository({
      host,
      id,
      status,
      bootstrapKey,
    });

    return {
      status: "success",
      message: `Статус обновлён: ${status}`,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error),
    };
  }
}
