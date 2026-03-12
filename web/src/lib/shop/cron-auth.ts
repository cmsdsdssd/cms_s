export type CronSecretInputs = {
  shopSyncCronSecret?: string | null;
  cronSecret?: string | null;
};

const trim = (value: unknown): string => String(value ?? "").trim();

const uniqueNonEmpty = (values: Array<unknown>): string[] => {
  const out: string[] = [];
  for (const value of values) {
    const normalized = trim(value);
    if (!normalized || out.includes(normalized)) continue;
    out.push(normalized);
  }
  return out;
};

const readAuthorizationBearer = (request: Request): string => {
  const raw = trim(request.headers.get("authorization"));
  if (!raw) return "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return trim(match?.[1]);
};

export function resolveAllowedCronSecrets(inputs: CronSecretInputs): string[] {
  return uniqueNonEmpty([inputs.shopSyncCronSecret, inputs.cronSecret]);
}

export function resolveProvidedCronSecrets(request: Request, bodyObj: Record<string, unknown>): string[] {
  const { searchParams } = new URL(request.url);
  return uniqueNonEmpty([
    request.headers.get("x-shop-sync-secret"),
    bodyObj.secret,
    searchParams.get("secret"),
    readAuthorizationBearer(request),
  ]);
}

export function isAuthorizedCronRequest(request: Request, bodyObj: Record<string, unknown>, inputs: CronSecretInputs): boolean {
  const allowedSecrets = resolveAllowedCronSecrets(inputs);
  if (allowedSecrets.length === 0) return false;
  const providedSecrets = resolveProvidedCronSecrets(request, bodyObj);
  return providedSecrets.some((provided) => allowedSecrets.includes(provided));
}
