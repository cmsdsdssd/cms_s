type GeminiGenerateInput = {
  imageBytes: Uint8Array;
  imageMimeType: string;
  prompt: string;
  timeoutMs?: number;
};

type GeminiGenerateResult = {
  imageBytes: Uint8Array;
  mimeType: string;
  statusCode: number;
};

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_MODEL = "gemini-2.5-flash-image";

function toBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(value: string) {
  return new Uint8Array(Buffer.from(value, "base64"));
}

function getApiKey() {
  return (process.env.GEMINI_API_KEY ?? process.env.NANOBANANA_API_KEY ?? "").trim();
}

function getBaseUrl() {
  const geminiApiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (geminiApiKey) return DEFAULT_BASE_URL;
  return (process.env.NANOBANANA_BASE_URL ?? DEFAULT_BASE_URL).trim();
}

function parseImagePart(payload: unknown): { mimeType: string; bytes: Uint8Array } | null {
  const root = payload as { candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> } }> };
  const parts = root.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;

  for (const part of parts) {
    const inlineData = (part.inlineData ?? part.inline_data) as { mimeType?: string; mime_type?: string; data?: string } | undefined;
    if (!inlineData?.data) continue;
    const mimeType = String(inlineData.mimeType ?? inlineData.mime_type ?? "image/png").trim() || "image/png";
    return { mimeType, bytes: fromBase64(inlineData.data) };
  }
  return null;
}

export async function generateNanobananaImage(input: GeminiGenerateInput): Promise<GeminiGenerateResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  }

  const baseUrl = getBaseUrl();
  const model = (process.env.NANOBANANA_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const endpoint = `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: input.prompt },
          {
            inline_data: {
              mime_type: input.imageMimeType,
              data: toBase64(input.imageBytes),
            },
          },
        ],
      },
    ],
  };

  let lastStatus = 500;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      lastStatus = response.status;
      const json = (await response.json().catch(() => ({}))) as unknown;
      if (!response.ok) {
        if (response.status >= 500 && attempt < 2) continue;
        const errorText = JSON.stringify(json).slice(0, 400);
        throw new Error(`NANOBANANA_UPSTREAM_ERROR:${response.status}:${errorText}`);
      }
      const parsed = parseImagePart(json);
      if (!parsed) throw new Error("NANOBANANA_UPSTREAM_ERROR:invalid_image_payload");
      return {
        imageBytes: parsed.bytes,
        mimeType: parsed.mimeType,
        statusCode: response.status,
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        if (attempt < 2) continue;
        throw new Error("NANOBANANA_TIMEOUT");
      }
      if (attempt < 2) continue;
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`NANOBANANA_UPSTREAM_ERROR:${lastStatus}`);
}
