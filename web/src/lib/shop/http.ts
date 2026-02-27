export async function shopApiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const body = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return body;
}

export async function shopApiSend<T>(url: string, method: "POST" | "PUT" | "DELETE", payload?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

  const body = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return body;
}
