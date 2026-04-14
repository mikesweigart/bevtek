import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ItemForm } from "../../ItemForm";

type Item = {
  id: string;
  sku: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  size_ml: number | null;
  abv: number | null;
  price: number | null;
  cost: number | null;
  stock_qty: number;
  description: string | null;
  tasting_notes: string | null;
  image_url: string | null;
  is_active: boolean;
};

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user!.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "owner" && role !== "manager") redirect(`/inventory/${id}`);

  const { data: item } = (await supabase
    .from("inventory")
    .select(
      "id, sku, name, brand, category, subcategory, size_ml, abv, price, cost, stock_qty, description, tasting_notes, image_url, is_active",
    )
    .eq("id", id)
    .maybeSingle()) as { data: Item | null };

  if (!item) notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/inventory/${item.id}`}
        className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
      >
        ← Back
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit item</h1>
      </div>
      <ItemForm initialValues={item} />
    </div>
  );
}
