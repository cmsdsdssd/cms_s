import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PdfRenderError, renderPdfFromHtml } from "@/lib/pdf/cloudflare-pdf";

export const runtime = "nodejs";

type FaxPdfRequest = {
  po_id?: string;
  vendor_prefix?: string;
  vendor_name?: string;
  line_count?: number;
  html_content?: string;
  mode?: "uplus_print" | string;
};

function nowKstStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}${m}${day}-${hh}${mm}${ss}`;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

function jsonError(
  status: number,
  payload: {
    error: string;
    error_code: string;
    action?: "fallback_print_html";
    details?: string;
    cf_ray?: string;
  },
) {
  return NextResponse.json(payload, { status });
}

function mapPdfError(error: unknown) {
  if (!(error instanceof PdfRenderError)) {
    return {
      status: 502,
      code: "CF_UNKNOWN",
      message: "PDF 생성 실패",
      action: "fallback_print_html" as const,
      cfRay: undefined,
    };
  }

  switch (error.code) {
    case "CF_429":
      return {
        status: 429,
        code: "CF_429",
        message: "Cloudflare rate limit",
        action: "fallback_print_html" as const,
        cfRay: error.cfRay,
      };
    case "CF_TIMEOUT":
      return {
        status: 504,
        code: "CF_TIMEOUT",
        message: "Cloudflare timeout",
        action: "fallback_print_html" as const,
        cfRay: error.cfRay,
      };
    case "CF_5XX":
      return {
        status: 502,
        code: "CF_5XX",
        message: "Cloudflare server error",
        action: "fallback_print_html" as const,
        cfRay: error.cfRay,
      };
    case "CF_NETWORK":
      return {
        status: 502,
        code: "CF_NETWORK",
        message: "Cloudflare network error",
        action: "fallback_print_html" as const,
        cfRay: error.cfRay,
      };
    case "CF_CONFIG":
      return {
        status: 500,
        code: "CF_CONFIG",
        message: "Cloudflare configuration missing",
        action: "fallback_print_html" as const,
        cfRay: error.cfRay,
      };
    default:
      return {
        status: 502,
        code: "CF_BAD_RESPONSE",
        message: "Cloudflare bad response",
        action: "fallback_print_html" as const,
        cfRay: error.cfRay,
      };
  }
}

async function uploadPdfWithFallback(params: {
  poId: string;
  pdfBuffer: Buffer;
  filePath: string;
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase env missing");
  }

  const candidates = ["factory-orders", "receipts"];
  let lastError: string | undefined;

  for (const bucket of candidates) {
    const { error } = await supabase.storage.from(bucket).upload(params.filePath, params.pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

    if (!error) {
      const signed = await supabase.storage.from(bucket).createSignedUrl(params.filePath, 600);
      if (signed.error || !signed.data?.signedUrl) {
        throw new Error(signed.error?.message || "signed URL creation failed");
      }
      return { bucket, signedUrl: signed.data.signedUrl };
    }
    lastError = error.message;
  }

  throw new Error(lastError || "storage upload failed");
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const body = (await request.json()) as FaxPdfRequest;
    const poId = String(body.po_id ?? "").trim();
    const html = String(body.html_content ?? "").trim();
    const mode = String(body.mode ?? "").trim();
    const vendorPrefix = String(body.vendor_prefix ?? "").trim();

    if (!poId || !html) {
      return jsonError(400, {
        error: "Missing required fields: po_id, html_content",
        error_code: "BAD_REQUEST",
      });
    }

    if (mode !== "uplus_print") {
      return jsonError(400, {
        error: "mode must be uplus_print",
        error_code: "BAD_MODE",
      });
    }

    const render = await renderPdfFromHtml(html, { requestId: poId });
    const stamp = nowKstStamp();
    const path = `factory-pos/${poId}/fax-uplus-${stamp}.pdf`;
    const sha256 = createHash("sha256").update(render.pdf).digest("hex");

    const uploaded = await uploadPdfWithFallback({
      poId,
      pdfBuffer: render.pdf,
      filePath: path,
    });

    console.info("fax_pdf_created", {
      event: "fax_pdf_created",
      po_id: poId,
      vendor_prefix: vendorPrefix || null,
      cf_ray: render.cfRay ?? null,
      duration_ms: Date.now() - startedAt,
      bucket: uploaded.bucket,
      size_bytes: render.pdf.byteLength,
    });

    return NextResponse.json({
      success: true,
      po_id: poId,
      pdf: {
        path,
        signed_url: uploaded.signedUrl,
        sha256,
        expires_in: 600,
      },
    });
  } catch (error) {
    const mapped = mapPdfError(error);
    console.error("fax_pdf_failed", {
      event: "fax_pdf_failed",
      error_code: mapped.code,
      cf_ray: mapped.cfRay ?? null,
      duration_ms: Date.now() - startedAt,
      details: error instanceof Error ? error.message : String(error),
    });

    return jsonError(mapped.status, {
      error: mapped.message,
      error_code: mapped.code,
      action: mapped.action,
      details: error instanceof Error ? error.message : String(error),
      cf_ray: mapped.cfRay,
    });
  }
}
