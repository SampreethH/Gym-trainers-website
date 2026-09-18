import { NextResponse } from "next/server";
import { ApiError, dispatch } from "@/lib/ops";
import { clearSessionCookie, readSessionUser, setSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const op = String(body.op ?? "");
  try {
    if (op === "logout") {
      const res = NextResponse.json({ ok: true });
      clearSessionCookie(res);
      return res;
    }
    const actor = op === "login" ? null : await readSessionUser();
    const data = await dispatch(op, body, actor);
    const res = NextResponse.json({ ok: true, data });
    if (op === "login") {
      const user = (data as { user: { id: string } }).user;
      setSessionCookie(res, user.id);
    }
    return res;
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ ok: false, error: { code: status === 402 ? "SUBSCRIPTION_INACTIVE" : "ERROR", message } }, { status });
  }
}
