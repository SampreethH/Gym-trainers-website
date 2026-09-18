export async function elevate<T>(op: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/elevate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, ...body }),
  });
  const json = (await res.json()) as {
    ok: boolean;
    data?: T;
    error?: { message: string; code?: string };
  };
  if (!json.ok) {
    const err = new Error(json.error?.message ?? "Request failed") as Error & { code?: string; status?: number };
    err.code = json.error?.code;
    err.status = res.status;
    throw err;
  }
  return json.data as T;
}

export async function logout() {
  await elevate("logout");
  window.location.href = "/";
}
