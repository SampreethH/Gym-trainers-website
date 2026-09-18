import { getStore, tenantAccess } from "@/lib/store";
import { requireRole } from "@/lib/guard";
import { redirect } from "next/navigation";

export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("trainer");
  const store = await getStore();
  if (!tenantAccess(store, user)) redirect("/billing/blocked");
  return children;
}
