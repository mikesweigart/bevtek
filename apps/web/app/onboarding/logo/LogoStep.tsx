"use client";

import { useState } from "react";
import { ImageUpload } from "@/components/ImageUpload";
import { saveLogoAction } from "./actions";

export function LogoStep({
  storeId,
  initialLogo,
}: {
  storeId: string;
  initialLogo: string | null;
}) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogo);

  return (
    <form action={saveLogoAction} className="space-y-6">
      <input type="hidden" name="logo_url" value={logoUrl ?? ""} />
      <input type="hidden" name="next" value="/onboarding/inventory" />

      <ImageUpload
        label="Drop your store logo (optional)"
        storeId={storeId}
        pathPrefix="logos"
        value={logoUrl}
        onChange={setLogoUrl}
        size="lg"
      />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-2.5 text-sm font-semibold"
        >
          {logoUrl ? "Save & continue" : "Continue"}
        </button>
        <button
          type="submit"
          formAction={saveLogoAction}
          name="logo_url"
          value=""
          className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
        >
          Skip for now
        </button>
      </div>
    </form>
  );
}
