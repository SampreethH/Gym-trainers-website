import { readSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/types";

export async function requireRole(role: Role) {
  const user = await readSessionUser();
  if (!user) redirect("/enter");
  if (user.role !== role) redirect("/enter");
  return user;
}
