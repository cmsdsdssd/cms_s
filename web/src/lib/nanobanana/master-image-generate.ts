import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { buildNanobananaPrompt } from "@/lib/nanobanana/prompt-builder";
import { generateNanobananaImage } from "@/lib/nanobanana/gemini-client";
import { addModelNameOverlay } from "@/lib/nanobanana/overlay";

export type MasterImageGenerateInput = {
  masterId: string;
  productPose?: number;
  backgroundStyle?: number;
  customPrompt?: string;
  displayName?: string;
  showModelNameOverlay?: boolean;
  textColor?: string;
  requestId: string;
};

export type MasterImageGenerateResult = {
  masterId: string;
  imagePath: string;
  imageUrl: string;
  promptHash: string;
  legacyPath: string | null;
};

export type MasterImagePreviewResult = {
  masterId: string;
  sourcePath: string;
  sourceMimeType: string;
  generatedBase64: string;
  generatedMimeType: string;
  promptHash: string;
  promptText: string;
  modelUsed: string;
  inputImageSha256: string;
  outputImageSha256: string;
};

export type ApplyGeneratedMasterImageInput = {
  masterId: string;
  sourcePath: string;
  sourceMimeType?: string;
  generatedBase64: string;
  generatedMimeType: string;
  requestId: string;
};

type MasterRow = {
  master_id: string;
  model_name: string | null;
  image_path: string | null;
};

type MasterSourceImage = {
  sourcePath: string;
  sourceBlob: Blob;
  sourceMimeType: string;
  defaultDisplayName: string;
};

function normalizeLegacyName(value: string) {
  const trimmed = value.trim();
  const safe = trimmed
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return safe || "model";
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function nextLegacyRelativePath(params: {
  supabase: SupabaseClient;
  bucket: string;
  folder: string;
  baseName: string;
  ext: string;
}) {
  const { data, error } = await params.supabase.storage.from(params.bucket).list(params.folder, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) {
    throw new Error(`legacy 목록 조회 실패: ${error.message}`);
  }

  const matcher = new RegExp(`^${escapeRegex(params.baseName)}_(\\d+)\\.[^.]+$`, "i");
  let maxIndex = -1;
  for (const item of data ?? []) {
    const name = String(item.name ?? "").trim();
    if (!name) continue;
    const m = name.match(matcher);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n)) maxIndex = Math.max(maxIndex, n);
  }
  const next = String(Math.max(1, maxIndex + 1)).padStart(2, "0");
  return `${params.folder}/${params.baseName}_${next}.${params.ext}`;
}

function toOverlayModelName(value: string) {
  const raw = value.trim();
  if (!raw) return raw;
  const firstDash = raw.indexOf("-");
  if (firstDash < 0) return raw;
  const head = raw.slice(0, firstDash).trim();
  if (!/^[A-Za-z]{1,6}$/.test(head)) return raw;
  const stripped = raw.slice(firstDash + 1).trim();
  return stripped || raw;
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");
  }
  return createClient(url, key);
}

function getBucketName() {
  return process.env.SUPABASE_BUCKET ?? "master_images";
}

function getLegacyBucketName() {
  return process.env.SUPABASE_LEGACY_BUCKET ?? "legacy";
}

function normalizePath(path: string, bucket: string) {
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      const marker = `/storage/v1/object/public/${bucket}/`;
      const idx = url.pathname.indexOf(marker);
      if (idx >= 0) {
        return decodeURIComponent(url.pathname.slice(idx + marker.length));
      }
    } catch {
      // ignore URL parse errors and fall through
    }
  }
  if (path.startsWith(`${bucket}/`)) return path.slice(bucket.length + 1);
  return path;
}

async function prepareModelInputImage(bytes: Uint8Array, mimeType: string) {
  try {
    const image = sharp(Buffer.from(bytes)).rotate();
    const metadata = await image.metadata();
    const width = Number(metadata.width ?? 0);
    const height = Number(metadata.height ?? 0);
    const side = Math.max(width, height);

    const normalized = await (side > 0
      ? image
          .clone()
          .resize(side, side, {
            fit: "contain",
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          })
          .png({ compressionLevel: 9 })
          .toBuffer()
      : image.clone().png({ compressionLevel: 9 }).toBuffer());

    return {
      imageBytes: new Uint8Array(normalized),
      imageMimeType: "image/png",
      originalMimeType: mimeType,
    };
  } catch {
    return {
      imageBytes: bytes,
      imageMimeType: mimeType,
      originalMimeType: mimeType,
    };
  }
}

async function ensureSquareOutputImage(bytes: Uint8Array) {
  try {
    const image = sharp(Buffer.from(bytes)).rotate();
    const metadata = await image.metadata();
    const width = Number(metadata.width ?? 0);
    const height = Number(metadata.height ?? 0);
    if (width <= 0 || height <= 0) {
      return bytes;
    }
    const side = Math.max(width, height);
    const squared = await image
      .clone()
      .resize(side, side, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return new Uint8Array(squared);
  } catch {
    return bytes;
  }
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  return "png";
}

function nowStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}${MM}${dd}${hh}${mm}${ss}`;
}

function toErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
  if (message.includes("NANOBANANA_TIMEOUT")) return "NANOBANANA_TIMEOUT";
  if (message.includes("NANOBANANA_UPSTREAM_ERROR")) return "NANOBANANA_UPSTREAM_ERROR";
  return "INTERNAL_ERROR";
}

function decodeBase64ToBytes(base64: string) {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

function encodeBytesToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function sha256OfBytes(bytes: Uint8Array) {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

async function archiveOriginalImage(
  supabase: SupabaseClient,
  bucket: string,
  legacyBucket: string,
  masterId: string,
  modelName: string,
  sourcePath: string,
  sourceBlob: Blob,
  sourceMimeType: string
) {
  const ext = sourcePath.split(".").pop() || extensionFromMimeType(sourceMimeType);
  const baseName = normalizeLegacyName(modelName);
  const folder = baseName;
  const legacyRelativePath = await nextLegacyRelativePath({
    supabase,
    bucket: legacyBucket,
    folder,
    baseName,
    ext,
  });
  const { error: legacyUploadError } = await supabase.storage
    .from(legacyBucket)
    .upload(legacyRelativePath, sourceBlob, { upsert: true, contentType: sourceMimeType });

  if (!legacyUploadError) {
    return `${legacyBucket}/${legacyRelativePath}`;
  }

  const isMissingBucket = legacyUploadError.message.toLowerCase().includes("bucket not found");
  if (!isMissingBucket) {
    throw new Error(`legacy 보관 실패: ${legacyUploadError.message}`);
  }

  const fallbackPath = `legacy/${legacyRelativePath}`;
  const { error: fallbackUploadError } = await supabase.storage
    .from(bucket)
    .upload(fallbackPath, sourceBlob, { upsert: true, contentType: sourceMimeType });
  if (fallbackUploadError) {
    throw new Error(`legacy 보관 실패: ${fallbackUploadError.message}`);
  }
  return `${bucket}/${fallbackPath}`;
}

async function readMasterSourceImage(
  supabase: SupabaseClient,
  bucket: string,
  masterId: string
) {
  const { data: masterRow, error: masterError } = await supabase
    .from("cms_master_item")
    .select("master_id,model_name,image_path")
    .eq("master_id", masterId)
    .maybeSingle();
  if (masterError) throw new Error(masterError.message || "마스터 조회 실패");
  if (!masterRow) throw new Error("마스터를 찾을 수 없습니다.");

  const row = masterRow as MasterRow;
  const sourcePath = normalizePath(String(row.image_path ?? "").trim(), bucket);
  if (!sourcePath) {
    throw new Error("대표 이미지가 없어 자동생성을 진행할 수 없습니다.");
  }

  const { data: sourceBlob, error: downloadError } = await supabase.storage.from(bucket).download(sourcePath);
  if (downloadError || !sourceBlob) throw new Error(downloadError?.message ?? "원본 이미지 다운로드 실패");
  const defaultDisplayName = toOverlayModelName(String(row.model_name ?? "").trim() || "product");
  return {
    sourcePath,
    sourceBlob,
    sourceMimeType: sourceBlob.type || "image/png",
    defaultDisplayName,
  } as MasterSourceImage;
}

export async function generateMasterImagePreviewWithNanobanana(
  input: MasterImageGenerateInput
): Promise<MasterImagePreviewResult> {
  const supabase = getSupabaseAdmin();
  const bucket = getBucketName();
  const source = await readMasterSourceImage(supabase, bucket, input.masterId);

  const imageBytes = new Uint8Array(await source.sourceBlob.arrayBuffer());
  const prepared = await prepareModelInputImage(imageBytes, source.sourceMimeType);
  const promptResult = buildNanobananaPrompt({
    productPose: input.productPose,
    backgroundStyle: input.backgroundStyle,
    customPrompt: input.customPrompt,
  });

  let generated;
  try {
    generated = await generateNanobananaImage({
      imageBytes: prepared.imageBytes,
      imageMimeType: prepared.imageMimeType,
      prompt: promptResult.prompt,
      timeoutMs: 120_000,
    });
  } catch (error) {
    const code = toErrorCode(error);
    throw new Error(code);
  }

  const overlayEnabled = input.showModelNameOverlay ?? true;
  const requestedDisplayName = String(input.displayName ?? "").trim();
  const displayName = requestedDisplayName || source.defaultDisplayName || "product";
  const textColor = String(input.textColor ?? "black").trim() || "black";
  const squareGeneratedBytes = await ensureSquareOutputImage(generated.imageBytes);
  const overlayedBytes = overlayEnabled
    ? await addModelNameOverlay({
      imageBytes: squareGeneratedBytes,
      displayName,
      textColor,
    })
    : squareGeneratedBytes;
  const finalSquareBytes = await ensureSquareOutputImage(overlayedBytes);

  return {
    masterId: input.masterId,
    sourcePath: source.sourcePath,
    sourceMimeType: source.sourceMimeType,
    generatedBase64: encodeBytesToBase64(finalSquareBytes),
    generatedMimeType: "image/png",
    promptHash: promptResult.promptHash,
    promptText: promptResult.prompt,
    modelUsed: generated.modelUsed,
    inputImageSha256: sha256OfBytes(prepared.imageBytes),
    outputImageSha256: sha256OfBytes(finalSquareBytes),
  };
}

export async function applyGeneratedMasterImage(
  input: ApplyGeneratedMasterImageInput
): Promise<MasterImageGenerateResult> {
  const supabase = getSupabaseAdmin();
  const bucket = getBucketName();
  const legacyBucket = getLegacyBucketName();

  const sourcePath = normalizePath(input.sourcePath, bucket);
  const { data: sourceBlob, error: sourceError } = await supabase.storage.from(bucket).download(sourcePath);
  if (sourceError || !sourceBlob) throw new Error(sourceError?.message ?? "원본 이미지 다운로드 실패");
  const sourceMimeType = input.sourceMimeType || sourceBlob.type || "image/png";

  const { data: masterRow, error: masterError } = await supabase
    .from("cms_master_item")
    .select("model_name")
    .eq("master_id", input.masterId)
    .maybeSingle();
  if (masterError) {
    throw new Error(`마스터 조회 실패: ${masterError.message}`);
  }
  const modelName = toOverlayModelName(String((masterRow as { model_name?: string | null } | null)?.model_name ?? "").trim() || input.masterId);

  const generatedBytes = decodeBase64ToBytes(input.generatedBase64);
  const ext = extensionFromMimeType(input.generatedMimeType);
  const activePath = sourcePath || `master/${input.masterId}/main.${ext}`;

  let legacyPath: string | null = null;
  try {
    legacyPath = await archiveOriginalImage(
      supabase,
      bucket,
      legacyBucket,
      input.masterId,
      modelName,
      sourcePath,
      sourceBlob,
      sourceMimeType
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[nanobanana] legacy archive skipped", {
      requestId: input.requestId,
      masterId: input.masterId,
      sourcePath,
      message,
    });
  }

  const { error: activeUploadError } = await supabase.storage
    .from(bucket)
    .upload(activePath, generatedBytes, { upsert: true, contentType: input.generatedMimeType });
  if (activeUploadError) {
    throw new Error(`대표 이미지 교체 실패: ${activeUploadError.message}`);
  }

  const { error: updateError } = await supabase
    .from("cms_master_item")
    .update({ image_path: activePath })
    .eq("master_id", input.masterId);
  if (updateError) {
    throw new Error(`마스터 업데이트 실패: ${updateError.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(activePath);
  return {
    masterId: input.masterId,
    imagePath: activePath,
    imageUrl: `${data.publicUrl}?v=${Date.now()}`,
    promptHash: "",
    legacyPath,
  };
}

export async function generateMasterImageWithNanobanana(input: MasterImageGenerateInput): Promise<MasterImageGenerateResult> {
  const promptResult = buildNanobananaPrompt({
    productPose: input.productPose,
    backgroundStyle: input.backgroundStyle,
    customPrompt: input.customPrompt,
  });

  const startedAt = Date.now();
  const preview = await generateMasterImagePreviewWithNanobanana(input);
  const applied = await applyGeneratedMasterImage({
    masterId: input.masterId,
    sourcePath: preview.sourcePath,
    sourceMimeType: preview.sourceMimeType,
    generatedBase64: preview.generatedBase64,
    generatedMimeType: preview.generatedMimeType,
    requestId: input.requestId,
  });
  const elapsedMs = Date.now() - startedAt;
  console.info("[nanobanana] generated", {
    requestId: input.requestId,
    masterId: input.masterId,
    latencyMs: elapsedMs,
    promptHash: promptResult.promptHash,
  });

  return {
    ...applied,
    promptHash: promptResult.promptHash,
    legacyPath: applied.legacyPath,
  };
}
