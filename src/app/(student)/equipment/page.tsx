import type { Metadata } from "next";
import { Package } from "lucide-react";
import { BorrowForm } from "@/components/phase3/equipment/borrow-form";
import { Phase3Header, Phase3Notice } from "@/components/phase3/common";
import { EmptyState } from "@/components/shared/empty-state";
import { requireUser } from "@/lib/auth/session";
import { getEquipmentAssets, getEquipmentItems } from "@/lib/data/phase3-equipment";
import { toIstLocalInput } from "@/lib/time/india";

export const metadata: Metadata = { title: "Borrow equipment" };

export default async function StudentEquipmentPage() {
  await requireUser();
  const [items, assets] = await Promise.all([getEquipmentItems(), getEquipmentAssets()]);
  const availableItems = items.filter((item) => item.isActive && item.availableQuantity > 0);
  const defaultReturnAt = toIstLocalInput(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="Student / PE resources"
        title="Equipment issue"
        description="Choose equipment available from the PE store, set a return time and collect it from the office. Your PE membership and directory record are checked automatically."
      />

      <Phase3Notice>
        Return equipment on time so it stays available for the next student. Damaged items must be reported when you return them.
      </Phase3Notice>

      {availableItems.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No equipment available right now"
          description="Everything in the catalogue is currently with students or being prepared. Check back later or ask the PE office."
        />
      ) : (
        <div className="space-y-5">
          {availableItems.map((item) => {
            const availableAssets = assets.filter(
              (asset) => asset.itemId === item.id && asset.status === "available",
            );
            return (
              <article key={item.id} className="border-l-4 border-l-lime bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow text-cobalt">{item.categoryName}</p>
                    <h2 className="mt-1 text-3xl font-bold leading-none">{item.name}</h2>
                    {item.description ? (
                      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">{item.description}</p>
                    ) : null}
                  </div>
                  <div className="border border-navy/15 bg-navy/[0.03] px-4 py-3 text-right">
                    <p className="eyebrow text-ink-muted">
                      {item.trackingMode === "individual" ? "Units ready" : "Quantity ready"}
                    </p>
                    <p className="mt-1 font-barlow text-4xl leading-none">
                      {item.trackingMode === "individual" ? availableAssets.length : item.availableQuantity}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-muted">
                  {item.storageLocation ? <span>Collect from: {item.storageLocation}</span> : null}
                  {item.identificationNumber ? <span>Ref: {item.identificationNumber}</span> : null}
                </div>
                {item.trackingMode === "individual" && availableAssets.length === 0 ? (
                  <p className="mt-4 border-l-4 border-l-coral bg-coral/10 p-3 text-xs text-coral-dark">
                    No individual unit is ready at the moment.
                  </p>
                ) : (
                  <BorrowForm
                    itemId={item.id}
                    itemName={item.name}
                    trackingMode={item.trackingMode}
                    availableQuantity={item.availableQuantity}
                    assets={availableAssets}
                    defaultReturnAt={defaultReturnAt}
                  />
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
