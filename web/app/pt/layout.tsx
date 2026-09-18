import { requireRole } from "@/lib/guard";

export default async function PtLayout({ children }: { children: React.ReactNode }) {
  await requireRole("pt_client");
  return children;
}
