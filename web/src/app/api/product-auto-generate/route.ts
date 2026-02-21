import { NextResponse } from "next/server";
import { buildNanobananaPrompt, normalizeBackground, normalizePose } from "@/lib/nanobanana/prompt-builder";
import { generateNanobananaImage } from "@/lib/nanobanana/gemini-client";
import { addModelNameOverlay } from "@/lib/nanobanana/overlay";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function jsonError(message: string, code: string, status: number) {
  return NextResponse.json({ success: false, error: message, code }, { status });
}

function parseBoolean(value: FormDataEntryValue | null, fallback: boolean) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function fileNameWithoutExt(name: string) {
  return name.replace(/\.[^.]+$/, "").trim();
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const image = formData.get("product_image");
  if (!(image instanceof File)) {
    return jsonError("이미지 파일이 필요합니다.", "INVALID_FILE_TYPE", 400);
  }
  if (!ALLOWED_TYPES.has(image.type)) {
    return jsonError("지원하지 않는 파일 형식입니다.", "INVALID_FILE_TYPE", 400);
  }
  if (image.size > MAX_FILE_SIZE) {
    return jsonError("파일 크기는 15MB를 초과할 수 없습니다.", "FILE_TOO_LARGE", 400);
  }

  const poseValue = Number(formData.get("product_pose") ?? 0);
  const backgroundValue = Number(formData.get("background_style") ?? 0);
  if (![0, 1, 2].includes(poseValue)) {
    return jsonError("product_pose 값이 올바르지 않습니다.", "INVALID_POSE_VALUE", 400);
  }
  if (![0, 1, 2, 3, 4, 5].includes(backgroundValue)) {
    return jsonError("background_style 값이 올바르지 않습니다.", "INVALID_BACKGROUND_STYLE", 400);
  }

  const customPrompt = String(formData.get("custom_prompt") ?? "");
  const showModelNameOverlay = parseBoolean(formData.get("show_model_name_overlay"), true);
  const textColor = String(formData.get("text_color") ?? "black").trim() || "black";
  const displayName =
    String(formData.get("display_name") ?? "").trim()
    || fileNameWithoutExt(image.name)
    || "product";

  const prompt = buildNanobananaPrompt({
    productPose: normalizePose(poseValue),
    backgroundStyle: normalizeBackground(backgroundValue),
    customPrompt,
  });

  try {
    const sourceBytes = new Uint8Array(await image.arrayBuffer());
    const generated = await generateNanobananaImage({
      imageBytes: sourceBytes,
      imageMimeType: image.type,
      prompt: prompt.prompt,
      timeoutMs: 120_000,
    });

    const outputBytes = showModelNameOverlay
      ? await addModelNameOverlay({
        imageBytes: generated.imageBytes,
        displayName,
        textColor,
      })
      : generated.imageBytes;

    return NextResponse.json({
      success: true,
      image: Buffer.from(outputBytes).toString("base64"),
      mime_type: "image/png",
      prompt_hash: prompt.promptHash,
      show_model_name_overlay: showModelNameOverlay,
      display_name: displayName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
    if (message === "NANOBANANA_TIMEOUT") {
      return jsonError("NanoBanana 요청 시간이 초과되었습니다.", "NANOBANANA_TIMEOUT", 504);
    }
    if (message.startsWith("NANOBANANA_UPSTREAM_ERROR")) {
      return jsonError("NanoBanana 연동 중 오류가 발생했습니다.", "NANOBANANA_UPSTREAM_ERROR", 502);
    }
    return jsonError("내부 오류가 발생했습니다.", "INTERNAL_ERROR", 500);
  }
}
