import type { Metadata } from "next";
import Link from "next/link";
import { QrCode, ScanLine } from "lucide-react";
import { BorrowForm } from "@/components/phase3/equipment/borrow-form";
import { ReturnForm } from "@/components/phase3/equipment/return-form";
import { Phase3Header, Phase3Notice, Phase3StatusBadge } from "@/components/phase3/common";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import {
  getEquipmentAssets,
  getMyEquipmentTransactions,
  resolveEquipmentQrToken,
} from "@/lib/data/phase3-equipment";
import { formatIstDateTime } from "@/lib/time/india";
import { defaultPhase3ReturnAt } from "@/lib/time/phase3";

export const metadata: Metadata = { title: "Equipment QR" };

export default async function EquipmentQrPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await requireUser();
  const { token } = await params;
  let qr = null;
  try {
    qr = await resolveEquipmentQrToken(token);
  } catch {
    qr = null;
  }

  if (!qr) {
    return (
      <div className="space-y-8">
        <Phase3Header kicker="Student / PE resources" title="Equipment QR" description="This page opens equipment posters scanned with the VARSITY PE app." />
        <Phase3Notice tone="warning">This QR code is invalid, inactive, or no longer linked to active equipment.</Phase3Notice>
        <EmptyState
          icon={ScanLine}
          title="Code not recognised"
          description="Ask the PE office for a current poster, or browse the equipment list to borrow manually."
          action={
            <Button asChild variant="lime">
              <Link href="/equipment">Browse equipment</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const [assets, transactions] = await Promise.all([
    getEquipmentAssets(qr.itemId),
    getMyEquipmentTransactions(),
  ]);
  const defaultReturnAt = defaultPhase3ReturnAt(3);
  const matchingOpen = transactions.filter(
    (entry) =>
      entry.itemId === qr.itemId &&
      (!qr.assetId || entry.assetId === qr.assetId) &&
      ["issued", "partially_returned", "overdue"].includes(entry.displayStatus),
  );
  const linkedAsset = qr.assetId ? assets.find((asset) => asset.id === qr.assetId) : undefined;
  const individual = qr.trackingMode === "individual";
  const assetAvailable = Boolean(qr.assetId && linkedAsset?.status === "available");

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="Equipment / QR scan"
        title={qr.itemName}
        description="Confirm the equipment in front of you, then borrow or return it from your student account."
      />

      <section className="border-t-4 border-t-lime bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center border-2 border-navy bg-lime/20">
              <QrCode className="size-6" />
            </div>
            <div>
              <p className="eyebrow text-cobalt">Scanned equipment</p>
              <h2 className="mt-1 text-3xl font-bold leading-none">{qr.itemName}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {qr.assetTag ? (
                  <span className="border border-navy/20 bg-navy/[0.03] px-3 py-1 font-mono text-xs font-bold">
                    {qr.assetTag}
                  </span>
                ) : null}
                <span className="text-xs capitalize text-ink-muted">Condition: {qr.condition.replaceAll("_", " ")}</span>
              </div>
            </div>
          </div>
          <div className="border border-navy/15 px-4 py-3 text-right">
            <p className="eyebrow text-ink-muted">{individual ? "Asset status" : "Units ready"}</p>
            <p className="mt-1 font-barlow text-4xl leading-none">
              {individual ? (matchingOpen.length ? "On loan" : assetAvailable ? "Ready" : "Unavailable") : qr.availableQuantity}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-xl font-bold">Return equipment</h3>
            {matchingOpen.length ? (
              <div className="mt-3 space-y-3">
                {matchingOpen.map((entry) => (
                  <div key={entry.id} className="border border-navy/15 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-ink-muted">Due {formatIstDateTime(entry.expectedReturnAt)}</p>
                      <Phase3StatusBadge label={entry.displayStatus} />
                    </div>
                    <div className="mt-2">
                      <ReturnForm transaction={entry} token={token} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 border border-dashed border-navy/20 p-4 text-xs text-ink-muted">
                You have no active loan for this equipment.
              </p>
            )}
          </div>

          <div>
            <h3 className="text-xl font-bold">Borrow equipment</h3>
            <div className="mt-3">
              {individual && qr.assetId ? (
                assetAvailable && matchingOpen.length === 0 ? (
                  <BorrowForm
                    itemId={qr.itemId}
                    itemName={qr.itemName}
                    trackingMode={qr.trackingMode}
                    availableQuantity={qr.availableQuantity}
                    assets={linkedAsset ? [linkedAsset] : []}
                    defaultReturnAt={defaultReturnAt}
                    lockedAssetId={qr.assetId}
                    lockedAssetLabel={qr.assetTag ?? ""}
                  />
                ) : (
                  <Phase3Notice tone="warning">
                    This unit is not ready to issue{assetAvailable ? "" : " right now"}. Ask the PE office for another.
                  </Phase3Notice>
                )
              ) : individual ? (
                assets.some((asset) => asset.status === "available") ? (
                  <BorrowForm
                    itemId={qr.itemId}
                    itemName={qr.itemName}
                    trackingMode={qr.trackingMode}
                    availableQuantity={qr.availableQuantity}
                    assets={assets.filter((asset) => asset.status === "available")}
                    defaultReturnAt={defaultReturnAt}
                  />
                ) : (
                  <Phase3Notice tone="warning">No unit of this equipment is ready to issue right now.</Phase3Notice>
                )
              ) : qr.availableQuantity > 0 ? (
                <BorrowForm
                  itemId={qr.itemId}
                  itemName={qr.itemName}
                  trackingMode={qr.trackingMode}
                  availableQuantity={qr.availableQuantity}
                  assets={[]}
                  defaultReturnAt={defaultReturnAt}
                />
              ) : (
                <Phase3Notice tone="warning">This equipment is currently out of stock.</Phase3Notice>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
