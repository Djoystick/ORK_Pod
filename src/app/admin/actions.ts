"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { bootstrapInitialPublishedContent } from "@/server/services/content-bootstrap-service";

export type BootstrapPublishedActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialBootstrapPublishedActionState: BootstrapPublishedActionState = {
  status: "idle",
  message: "",
};

export async function bootstrapPublishedContentAction(
  _prevState: BootstrapPublishedActionState,
  formData: FormData,
): Promise<BootstrapPublishedActionState> {
  const bootstrapKey = String(formData.get("bootstrapKey") ?? "").trim() || undefined;
  const host = (await headers()).get("host") ?? "";

  try {
    const result = await bootstrapInitialPublishedContent({
      host,
      bootstrapKey,
    });

    revalidatePath("/");
    revalidatePath("/streams");
    revalidatePath("/admin");
    revalidatePath("/admin/content");

    return {
      status: "success",
      message:
        `Bootstrap выполнен: created=${result.created}, skipped=${result.skipped}, failed=${result.failed}.` +
        (result.errors.length > 0 ? ` Ошибки: ${result.errors.join(" | ")}` : ""),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Не удалось выполнить bootstrap.",
    };
  }
}

