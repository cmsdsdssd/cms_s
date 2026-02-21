import { NextResponse } from "next/server";
import { generateMasterImagePreviewWithNanobanana, generateMasterImageWithNanobanana } from "@/lib/nanobanana/master-image-generate";

export const runtime = "nodejs";

type RequestBody = {
  master_id?: string;
  product_pose?: number;
  background_style?: number;
  custom_prompt?: string;
  show_model_name_overlay?: boolean;
  text_color?: string;
  display_name?: string;
  preview_only?: boolean;
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
  if (!masterId) {
    return jsonError("master_id 값이 필요합니다.", "INVALID_MASTER_ID", 400);
  }

  if (body.product_pose !== undefined && ![0, 1, 2].includes(Number(body.product_pose))) {
    return jsonError("product_pose 값이 올바르지 않습니다.", "INVALID_POSE_VALUE", 400);
  }
  if (body.background_style !== undefined && ![0, 1, 2, 3, 4, 5].includes(Number(body.background_style))) {
    return jsonError("background_style 값이 올바르지 않습니다.", "INVALID_BACKGROUND_STYLE", 400);
  }

  const requestId = crypto.randomUUID();
  try {
    if (body.preview_only) {
      const preview = await generateMasterImagePreviewWithNanobanana({
        masterId,
        productPose: body.product_pose,
        backgroundStyle: body.background_style,
        customPrompt: body.custom_prompt,
        displayName: body.display_name,
        showModelNameOverlay: body.show_model_name_overlay,
        textColor: body.text_color,
        requestId,
      });

      return NextResponse.json({
        success: true,
        mode: "preview",
        request_id: requestId,
        master_id: preview.masterId,
        source_path: preview.sourcePath,
        source_mime_type: preview.sourceMimeType,
        generated_image_base64: preview.generatedBase64,
        generated_mime_type: preview.generatedMimeType,
        prompt_hash: preview.promptHash,
        debug_prompt: preview.promptText,
        debug_prompt_hash: preview.promptHash,
      });
    }

    const result = await generateMasterImageWithNanobanana({
      masterId,
      productPose: body.product_pose,
      backgroundStyle: body.background_style,
      customPrompt: body.custom_prompt,
      displayName: body.display_name,
      showModelNameOverlay: body.show_model_name_overlay,
      textColor: body.text_color,
      requestId,
    });

    return NextResponse.json({
      success: true,
      request_id: requestId,
      master_id: result.masterId,
      image_path: result.imagePath,
      image_url: result.imageUrl,
      legacy_path: result.legacyPath,
      prompt_hash: result.promptHash,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
    if (message === "NANOBANANA_TIMEOUT") {
      return jsonError("NanoBanana 요청 시간이 초과되었습니다.", "NANOBANANA_TIMEOUT", 504);
    }
    if (message.startsWith("NANOBANANA_UPSTREAM_ERROR")) {
      return jsonError(`NanoBanana 연동 중 오류가 발생했습니다. (${message})`, "NANOBANANA_UPSTREAM_ERROR", 502);
    }
    return jsonError(message || "내부 오류가 발생했습니다.", "INTERNAL_ERROR", 500);
  }
}
