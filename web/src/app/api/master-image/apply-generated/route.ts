import { NextResponse } from "next/server";
import { applyGeneratedMasterImage } from "@/lib/nanobanana/master-image-generate";

export const runtime = "nodejs";

type RequestBody = {
  master_id?: string;
  source_path?: string;
  source_mime_type?: string;
  generated_image_base64?: string;
  generated_mime_type?: string;
  prompt_hash?: string;
};

function jsonError(message: string, code: string, status: number) {
  return NextResponse.json({ success: false, error: message, code }, { status });
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return jsonError("잘못된 요청입니다.", "INVALID_REQUEST", 400);
  }

  const masterId = String(body.master_id ?? "").trim();
  const sourcePath = String(body.source_path ?? "").trim();
  const generatedBase64 = String(body.generated_image_base64 ?? "").trim();
  const generatedMimeType = String(body.generated_mime_type ?? "").trim();

  if (!masterId) return jsonError("master_id 값이 필요합니다.", "INVALID_MASTER_ID", 400);
  if (!sourcePath) return jsonError("source_path 값이 필요합니다.", "INVALID_SOURCE_PATH", 400);
  if (!generatedBase64) return jsonError("generated_image_base64 값이 필요합니다.", "INVALID_GENERATED_IMAGE", 400);
  if (!generatedMimeType) return jsonError("generated_mime_type 값이 필요합니다.", "INVALID_GENERATED_MIME", 400);

  try {
    const requestId = crypto.randomUUID();
    const result = await applyGeneratedMasterImage({
      masterId,
      sourcePath,
      sourceMimeType: body.source_mime_type,
      generatedBase64,
      generatedMimeType,
      requestId,
    });

    return NextResponse.json({
      success: true,
      request_id: requestId,
      master_id: result.masterId,
      image_path: result.imagePath,
      image_url: result.imageUrl,
      legacy_path: result.legacyPath,
      prompt_hash: body.prompt_hash ?? "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
    return jsonError(message || "내부 오류가 발생했습니다.", "INTERNAL_ERROR", 500);
  }
}
