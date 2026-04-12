import { resolveAdminGateContext } from "@/server/auth/admin-gate";
import { resolveCommunityWriteContext } from "@/server/auth/community-gate";
import { createManualContentViaRepository } from "@/server/services/admin-content-service";
import { setCommentModerationViaRepository } from "@/server/services/community-service";

async function run() {
  const adminExternal = await resolveAdminGateContext("example.com");
  const adminLocal = await resolveAdminGateContext("localhost:3000");
  const communityDefault = await resolveCommunityWriteContext();

  const previousMode = process.env.ORKPOD_COMMUNITY_WRITE_MODE;
  process.env.ORKPOD_COMMUNITY_WRITE_MODE = "supabase_auth_required";
  const communitySupabaseRequired = await resolveCommunityWriteContext();
  process.env.ORKPOD_COMMUNITY_WRITE_MODE = previousMode;

  const formData = new FormData();
  formData.set("title", "Auth smoke");
  formData.set("slug", "auth-smoke-item");
  formData.set("excerpt", "x");
  formData.set("description", "x");
  formData.set("category", "analysis");
  formData.set("platform", "youtube");
  formData.set("externalUrl", "https://youtube.com/watch?v=authsmoke");
  formData.set("status", "draft");

  let adminWriteBlocked = false;
  let moderationWriteBlocked = false;

  try {
    await createManualContentViaRepository(formData, "example.com");
  } catch {
    adminWriteBlocked = true;
  }

  try {
    await setCommentModerationViaRepository({
      host: "example.com",
      commentId: "missing",
      status: "approved",
    });
  } catch {
    moderationWriteBlocked = true;
  }

  console.log(
    JSON.stringify(
      {
        admin: {
          strategy: adminExternal.strategy,
          externalCanAccess: adminExternal.canAccessAdmin,
          localCanAccess: adminLocal.canAccessAdmin,
        },
        community: {
          defaultMode: communityDefault.mode,
          defaultCanWrite: communityDefault.canWrite,
          supabaseRequiredCanWrite: communitySupabaseRequired.canWrite,
        },
        writeProtection: {
          adminWriteBlocked,
          moderationWriteBlocked,
        },
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
