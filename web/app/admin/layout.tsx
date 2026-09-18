import { requireRole } from "@/lib/guard";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("platform_admin");
  return children;
}
