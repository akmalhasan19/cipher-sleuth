import { getSupabaseAdminClient } from "./supabase-admin";
import { getAppEnv } from "../validation/env";

export type EvidenceStorageResult = {
  stored: boolean;
  path: string | null;
  reason: "stored" | "guest" | "supabase-not-configured" | "upload-failed";
};

type StoreEvidenceParams = {
  userId: string | null;
  file: File;
  filenameNormalized: string;
  fileHashSha256: string;
};

export async function storeEvidenceAssetIfLoggedIn(
  params: StoreEvidenceParams
): Promise<EvidenceStorageResult> {
  if (!params.userId) {
    return {
      stored: false,
      path: null,
      reason: "guest",
    };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      stored: false,
      path: null,
      reason: "supabase-not-configured",
    };
  }

  const env = getAppEnv();
  const extension = params.filenameNormalized.split(".").pop() || "webp";
  const storagePath = `${params.userId}/${params.fileHashSha256}.${extension}`;
  const fileBuffer = Buffer.from(await params.file.arrayBuffer());

  const { error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: params.file.type || "application/octet-stream",
      upsert: true,
    });

  if (error) {
    return {
      stored: false,
      path: null,
      reason: "upload-failed",
    };
  }

  return {
    stored: true,
    path: storagePath,
    reason: "stored",
  };
}
