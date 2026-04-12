"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import {
  createSourceChannelViaRepository,
  syncAllSourcesViaRepository,
  syncSingleSourceViaRepository,
} from "@/server/services/admin-source-service";

export type SourceActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialSourceActionState: SourceActionState = {
  status: "idle",
  message: "",
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

export async function createSourceChannelAction(
  _prevState: SourceActionState,
  formData: FormData,
): Promise<SourceActionState> {
  try {
    const host = (await headers()).get("host") ?? "";
    await createSourceChannelViaRepository(formData, host);
    revalidatePath("/admin");
    revalidatePath("/admin/sources");

    return {
      status: "success",
      message: "Источник добавлен в реестр.",
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error),
    };
  }
}

export async function syncSourceChannelAction(
  _prevState: SourceActionState,
  formData: FormData,
): Promise<SourceActionState> {
  try {
    const host = (await headers()).get("host") ?? "";
    const run = await syncSingleSourceViaRepository(formData, host);
    revalidateAfterIngestion();

    return {
      status: run.status === "failed" ? "error" : "success",
      message:
        run.status === "failed"
          ? `Синк завершился ошибкой: ${run.errorMessage ?? "неизвестная ошибка"}`
          : `Run ${run.id}: created ${run.createdCount}, updated ${run.updatedCount}, skipped ${run.skippedCount}, failed ${run.failedCount}.`,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error),
    };
  }
}

export async function syncAllSourcesAction(
  _prevState: SourceActionState,
  formData: FormData,
): Promise<SourceActionState> {
  try {
    const host = (await headers()).get("host") ?? "";
    const result = await syncAllSourcesViaRepository(formData, host);
    revalidateAfterIngestion();

    const created = result.runs.reduce((acc, run) => acc + run.createdCount, 0);
    const updated = result.runs.reduce((acc, run) => acc + run.updatedCount, 0);
    const skipped = result.runs.reduce((acc, run) => acc + run.skippedCount, 0);
    const failed = result.runs.reduce((acc, run) => acc + run.failedCount, 0);
    const skippedLocked = result.skippedLockedSources.length;
    const hasFailedRun = result.runs.some((run) => run.status === "failed");

    return {
      status: hasFailedRun ? "error" : "success",
      message: `Sync all: created ${created}, updated ${updated}, skipped ${skipped}, failed ${failed}, locked ${skippedLocked}.`,
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error),
    };
  }
}
