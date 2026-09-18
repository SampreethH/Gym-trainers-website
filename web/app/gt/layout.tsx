import { requireRole } from "@/lib/guard";

export default async function GtLayout({ children }: { children: React.ReactNode }) {
  await requireRole("gt_client");
  return children;
}
