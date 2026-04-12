"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { rerunImportRunViaRepository } from "@/server/services/admin-source-service";

export type ImportActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Операция не выполнена.";
}

function revalidateAfterIngestion() {
  revalidatePath("/");
  revalidatePath("/streams");
  revalidatePath("/admin");
  revalidatePath("/admin/content");
  revalidatePath("/admin/sources");
  revalidatePath("/admin/imports");
}

export async function rerunImportRunAction(
  _prevState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  try {
    const host = (await headers()).get("host") ?? "";
    const run = await rerunImportRunViaRepository(formData, host);
    revalidateAfterIngestion();
    revalidatePath(`/admin/imports/${run.id}`);

    return {
      status: run.status === "failed" ? "error" : "success",
      message:
        run.status === "failed"
          ? `Rerun завершился ошибкой: ${run.errorMessage ?? "неизвестная ошибка"}`
          : `Rerun ${run.id}: created ${run.createdCount}, updated ${run.updatedCount}, skipped ${run.skippedCount}, failed ${run.failedCount}.`,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error),
    };
  }
}
