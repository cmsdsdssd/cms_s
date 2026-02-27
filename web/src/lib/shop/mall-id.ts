export type MallIdNormalizationResult =
  | { ok: true; mallId: string }
  | { ok: false; reason: string };

function stripProtocol(input: string): string {
  if (input.startsWith("http://")) return input.slice("http://".length);
  if (input.startsWith("https://")) return input.slice("https://".length);
  return input;
}

export function normalizeMallId(raw: string): MallIdNormalizationResult {
  const base = String(raw ?? "").trim().toLowerCase();
  if (!base) return { ok: false, reason: "mall_id is required" };

  const noProto = stripProtocol(base);
  const host = noProto.split("/")[0]?.split(":")[0]?.trim() ?? "";
  if (!host) return { ok: false, reason: "mall_id is required" };

  let candidate = host;
  if (candidate.endsWith(".cafe24api.com")) {
    candidate = candidate.slice(0, -".cafe24api.com".length);
  } else if (candidate.endsWith(".cafe24.com")) {
    candidate = candidate.slice(0, -".cafe24.com".length);
  }

  if (!candidate || candidate.includes(".")) {
    return { ok: false, reason: "mall_id must be shop prefix only (예: mymall), not a full domain" };
  }

  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(candidate)) {
    return { ok: false, reason: "mall_id format is invalid" };
  }

  return { ok: true, mallId: candidate };
}
