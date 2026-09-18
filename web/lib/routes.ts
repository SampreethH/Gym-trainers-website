import type { Role } from "./types";

export function homeFor(role: Role) {
  if (role === "gt_client") return "/gt";
  if (role === "pt_client") return "/pt";
  if (role === "trainer") return "/trainer";
  return "/admin";
}
