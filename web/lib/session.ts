import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getStore, processNoShows } from "./store";
import type { User } from "./types";
export { homeFor } from "./routes";

const COOKIE = "elevate_session";

export async function readSessionUser(): Promise<User | null> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) return null;
  const store = await getStore();
  processNoShows(store);
  return store.users.find((u) => u.id === id && u.status === "active") ?? null;
}

export function setSessionCookie(response: NextResponse, userId: string) {
  response.cookies.set(COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

