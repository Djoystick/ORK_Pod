"use server";

import { headers } from "next/headers";

import { createManualContentViaRepository } from "@/server/services/admin-content-service";

export type CreateManualActionState = {
  status: "idle" | "success" | "error";
  message: string;
  slug?: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Не удалось создать запись.";
}

export async function createManualContentAction(
  _prevState: CreateManualActionState,
  formData: FormData,
): Promise<CreateManualActionState> {
  try {
    const host = (await headers()).get("host") ?? "";
    const created = await createManualContentViaRepository(formData, host);

    return {
      status: "success",
      message: "Запись создана. Появится в публичном архиве, если статус = published.",
      slug: created.slug,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error),
    };
  }
}
