import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Stepper } from "../Stepper";

export default async function InventoryOnboardingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("store_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const storeId = (profile as { store_id?: string } | null)?.store_id;
  if (!storeId) redirect("/onboarding/store");

  // How many items already imported?
  const { count: itemCount } = await supabase
    .from("inventory")
    .select("*", { count: "exact", head: true });

  return (
    <div>
      <Stepper activeKey="inventory" />
      <div className="rounded-2xl bg-white border border-[color:var(--color-border)] p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Import your inventory
          </h1>
          <p className="text-sm text-[color:var(--color-muted)] mt-1">
            Drop a CSV or Excel export from your POS — Square, Lightspeed, or
            anything with columns. Megan auto-detects the format. You can also
            do this later from the Inventory tab.
          </p>
        </div>

        {itemCount && itemCount > 0 ? (
          <div className="rounded-lg border border-[color:var(--color-border)] bg-zinc-50 p-4 text-sm">
            <p className="font-medium">
              ✓ {itemCount.toLocaleString()} items already imported
            </p>
            <p className="text-xs text-[color:var(--color-muted)] mt-1">
              You can add more or update existing items from the Inventory tab.
            </p>
          </div>
        ) : (
          <ul className="space-y-2 text-sm text-[color:var(--color-muted)]">
            <li className="flex gap-2">
              <span className="text-[color:var(--color-gold)] font-semibold">
                ✓
              </span>
              <span>Drag-and-drop the file from your POS export</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[color:var(--color-gold)] font-semibold">
                ✓
              </span>
              <span>
                Megan auto-detects column names (name, SKU, price, stock, etc.)
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-[color:var(--color-gold)] font-semibold">
                ✓
              </span>
              <span>Preview before import — fix anything that looks off</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[color:var(--color-gold)] font-semibold">
                ✓
              </span>
              <span>
                After import, click &ldquo;Find product images&rdquo; to enrich
                your catalog automatically
              </span>
            </li>
          </ul>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/inventory/import"
            className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-2.5 text-sm font-semibold"
          >
            {itemCount && itemCount > 0
              ? "Import more items"
              : "Import a spreadsheet"}
          </Link>
          <Link
            href="/onboarding/team"
            className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
          >
            {itemCount && itemCount > 0 ? "Continue" : "Skip for now"}
          </Link>
        </div>
      </div>
    </div>
  );
}
