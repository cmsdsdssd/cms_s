import { createHash } from "node:crypto";
import { buildPromptText, type PromptInput, type ProductPose, type BackgroundStyle } from "@/lib/nanobanana/prompt-template";

export type { ProductPose, BackgroundStyle, PromptInput };
export { normalizePose, normalizeBackground, sanitizePrompt } from "@/lib/nanobanana/prompt-template";

export function buildNanobananaPrompt(input: PromptInput) {
  const { prompt, productPose, backgroundStyle } = buildPromptText(input);

  const promptHash = createHash("sha256").update(prompt, "utf8").digest("hex");
  return {
    prompt,
    promptHash,
    productPose,
    backgroundStyle,
  };
}
