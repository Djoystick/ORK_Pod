import "server-only";

const INACTIVE_RUNTIME_FRAGMENT = "Supabase ingestion path is not active in this phase runtime";

export function isIngestionRuntimeUnavailableError(error: unknown) {
  return (
    error instanceof Error &&
    typeof error.message === "string" &&
    error.message.includes(INACTIVE_RUNTIME_FRAGMENT)
  );
}

export function getIngestionRuntimeUnavailableMessage() {
  return "Ingestion runtime временно недоступен в текущем production-контуре. Раздел импортов показан в ограниченном режиме.";
}
