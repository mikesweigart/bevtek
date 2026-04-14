import { ImportWizard } from "../ImportWizard";

export default function InventoryImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import inventory</h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          Upload a spreadsheet to bulk-load items. Items with matching SKUs are
          updated in place.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
