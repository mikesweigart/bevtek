import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ItemForm } from "../ItemForm";

export default async function NewItemPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("role, store_id")
    .eq("id", auth.user!.id)
    .maybeSingle();
  const p = profile as { role?: string; store_id?: string } | null;
  if (p?.role !== "owner" && p?.role !== "manager") redirect("/inventory");
  const storeId = p.store_id!;

  return (
    <div className="space-y-6">
      <Link
        href="/inventory"
        className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
      >
        ← Inventory
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New item</h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          Add a product to your catalog.
        </p>
      </div>
      <ItemForm storeId={storeId} />
    </div>
  );
}
