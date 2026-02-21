const CLOUDFLARE_PDF_BASE_URL = "https://api.cloudflare.com/client/v4/accounts";
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 2;

export type PdfRenderErrorCode =
  | "CF_429"
  | "CF_5XX"
  | "CF_TIMEOUT"
  | "CF_NETWORK"
  | "CF_BAD_RESPONSE"
  | "CF_CONFIG";

export class PdfRenderError extends Error {
  readonly code: PdfRenderErrorCode;
  readonly status?: number;
  readonly cfRay?: string;
  readonly retryable: boolean;

  constructor(params: {
    code: PdfRenderErrorCode;
    message: string;
    status?: number;
    cfRay?: string;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(params.message, params.cause ? { cause: params.cause } : undefined);
    this.name = "PdfRenderError";
    this.code = params.code;
    this.status = params.status;
    this.cfRay = params.cfRay;
    this.retryable = params.retryable ?? false;
  }
}

type RenderPdfOptions = {
  requestId?: string;
  timeoutMs?: number;
};

type RenderPdfResult = {
  pdf: Buffer;
  cfRay?: string;
};

function getCloudflareConfig() {
  const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID ?? "").trim();
  const token = (process.env.CLOUDFLARE_API_TOKEN ?? "").trim();
  if (!accountId || !token) {
    throw new PdfRenderError({
      code: "CF_CONFIG",
      message: "Cloudflare PDF 설정이 없습니다. CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN 필요",
      retryable: false,
    });
  }

  return { accountId, token };
}

function buildEndpoint(accountId: string) {
  return `${CLOUDFLARE_PDF_BASE_URL}/${accountId}/browser-rendering/pdf`;
}

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, cleanup: () => clearTimeout(timer) };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown) {
  return error instanceof PdfRenderError && error.retryable;
}

async function renderOnce(params: {
  endpoint: string;
  token: string;
  html: string;
  timeoutMs: number;
  requestId?: string;
}): Promise<RenderPdfResult> {
  const { signal, cleanup } = createTimeoutSignal(params.timeoutMs);
  try {
    const response = await fetch(params.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.token}`,
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({
        html: params.html,
        gotoOptions: {
          waitUntil: "networkidle2",
          timeout: 60_000,
        },
        pdfOptions: {
          format: "A4",
          printBackground: true,
          preferCSSPageSize: true,
        },
      }),
    });

    const cfRay = response.headers.get("cf-ray") ?? undefined;

    if (response.status === 429) {
      throw new PdfRenderError({
        code: "CF_429",
        message: "Cloudflare PDF rate limit(429)",
        status: response.status,
        cfRay,
        retryable: false,
      });
    }

    if (response.status >= 500) {
      throw new PdfRenderError({
        code: "CF_5XX",
        message: `Cloudflare PDF server error (${response.status})`,
        status: response.status,
        cfRay,
        retryable: true,
      });
    }

    if (!response.ok) {
      throw new PdfRenderError({
        code: "CF_BAD_RESPONSE",
        message: `Cloudflare PDF unexpected response (${response.status})`,
        status: response.status,
        cfRay,
        retryable: false,
      });
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/pdf")) {
      throw new PdfRenderError({
        code: "CF_BAD_RESPONSE",
        message: `Cloudflare PDF content-type mismatch: ${contentType || "unknown"}`,
        status: response.status,
        cfRay,
        retryable: false,
      });
    }

    const raw = await response.arrayBuffer();
    if (!raw.byteLength) {
      throw new PdfRenderError({
        code: "CF_BAD_RESPONSE",
        message: "Cloudflare PDF empty body",
        status: response.status,
        cfRay,
        retryable: false,
      });
    }

    return { pdf: Buffer.from(raw), cfRay };
  } catch (error) {
    if (error instanceof PdfRenderError) throw error;

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new PdfRenderError({
        code: "CF_TIMEOUT",
        message: `Cloudflare PDF timeout (${params.timeoutMs}ms)`,
        retryable: false,
        cause: error,
      });
    }

    throw new PdfRenderError({
      code: "CF_NETWORK",
      message: "Cloudflare PDF network failure",
      retryable: true,
      cause: error,
    });
  } finally {
    cleanup();
  }
}

export async function renderPdfFromHtml(
  html: string,
  opts: RenderPdfOptions = {},
): Promise<RenderPdfResult> {
  if (!html || !html.trim()) {
    throw new PdfRenderError({
      code: "CF_BAD_RESPONSE",
      message: "html is required",
      retryable: false,
    });
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { accountId, token } = getCloudflareConfig();
  const endpoint = buildEndpoint(accountId);

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await renderOnce({
        endpoint,
        token,
        html,
        timeoutMs,
        requestId: opts.requestId,
      });
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS && isRetryableError(error)) {
        await sleep(200);
        continue;
      }
      throw error;
    }
  }

  throw new PdfRenderError({
    code: "CF_BAD_RESPONSE",
    message: "Cloudflare PDF rendering failed",
    retryable: false,
    cause: lastError,
  });
}
