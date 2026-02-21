import { NextResponse } from "next/server";
import { generateMasterImageWithNanobanana } from "@/lib/nanobanana/master-image-generate";

export const runtime = "nodejs";

type BatchItem = {
  master_id?: string;
  product_pose?: number;
  background_style?: number;
  custom_prompt?: string;
  show_model_name_overlay?: boolean;
  text_color?: string;
  display_name?: string;
};

type BatchBody = {
  items?: BatchItem[];
  concurrency?: number;
};

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function consume() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => consume()));
  return results;
}

export async function POST(request: Request) {
  let body: BatchBody;
  try {
    body = (await request.json()) as BatchBody;
  } catch {
    return NextResponse.json({ success: false, error: "잘못된 요청입니다.", code: "INVALID_REQUEST" }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ success: false, error: "items 값이 필요합니다.", code: "INVALID_ITEMS" }, { status: 400 });
  }
  if (items.length > 50) {
    return NextResponse.json({ success: false, error: "배치는 최대 50개까지 가능합니다.", code: "BATCH_TOO_LARGE" }, { status: 400 });
  }

  const concurrency = Math.max(1, Math.min(Number(body.concurrency ?? 3), 5));
  const batchId = crypto.randomUUID();

  const results = await runWithConcurrency(items, concurrency, async (item) => {
    const masterId = String(item.master_id ?? "").trim();
    if (!masterId) {
      return {
        master_id: "",
        success: false,
        code: "INVALID_MASTER_ID",
        error: "master_id 값이 필요합니다.",
      };
    }

    try {
      const requestId = crypto.randomUUID();
      const result = await generateMasterImageWithNanobanana({
        masterId,
        productPose: item.product_pose,
        backgroundStyle: item.background_style,
        customPrompt: item.custom_prompt,
        displayName: item.display_name,
        showModelNameOverlay: item.show_model_name_overlay,
        textColor: item.text_color,
        requestId,
      });
      return {
        master_id: masterId,
        success: true,
        request_id: requestId,
        image_path: result.imagePath,
        image_url: result.imageUrl,
        legacy_path: result.legacyPath,
        prompt_hash: result.promptHash,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
      const code = message === "NANOBANANA_TIMEOUT"
        ? "NANOBANANA_TIMEOUT"
        : message.startsWith("NANOBANANA_UPSTREAM_ERROR")
          ? "NANOBANANA_UPSTREAM_ERROR"
          : "INTERNAL_ERROR";
      return {
        master_id: masterId,
        success: false,
        code,
        error: message,
      };
    }
  });

  const successCount = results.filter((row) => row.success).length;
  const failCount = results.length - successCount;
  return NextResponse.json({
    success: failCount === 0,
    batch_id: batchId,
    total: results.length,
    success_count: successCount,
    fail_count: failCount,
    results,
  });
}
