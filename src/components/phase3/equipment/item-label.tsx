import { formatIstDate } from "@/lib/time/india";
import type { EquipmentAssetView, EquipmentItemView } from "@/types/domain";

export function ItemLabel({
  item,
  assets,
  loanCount,
}: {
  item: EquipmentItemView;
  assets: EquipmentAssetView[];
  loanCount: number;
}) {
  return (
    <section className="print-page border-2 border-navy bg-white p-6 print:border-navy print:p-8">
      <div className="flex items-start justify-between gap-4 border-b-4 border-navy pb-4">
        <div>
          <p className="eyebrow text-cobalt">VARSITY PE · Equipment record</p>
          <h2 className="mt-2 text-3xl font-bold leading-none">{item.name}</h2>
        </div>
        <div className="border-2 border-navy px-4 py-2 text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-muted">ID</p>
          <p className="font-mono text-sm font-bold">{item.identificationNumber ?? "—"}</p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 text-xs sm:grid-cols-4">
        <div>
          <dt className="eyebrow text-ink-muted">Category</dt>
          <dd className="mt-1 font-bold">{item.categoryName}</dd>
        </div>
        <div>
          <dt className="eyebrow text-ink-muted">Tracking</dt>
          <dd className="mt-1 font-bold capitalize">{item.trackingMode}</dd>
        </div>
        <div>
          <dt className="eyebrow text-ink-muted">Storage</dt>
          <dd className="mt-1 font-bold">{item.storageLocation ?? "—"}</dd>
        </div>
        <div>
          <dt className="eyebrow text-ink-muted">Registered quantity</dt>
          <dd className="mt-1 font-bold">{item.quantity}</dd>
        </div>
        <div>
          <dt className="eyebrow text-ink-muted">Available</dt>
          <dd className="mt-1 font-bold">{item.availableQuantity}</dd>
        </div>
        <div>
          <dt className="eyebrow text-ink-muted">On loan</dt>
          <dd className="mt-1 font-bold">{loanCount}</dd>
        </div>
        <div>
          <dt className="eyebrow text-ink-muted">Purchased</dt>
          <dd className="mt-1 font-bold">{formatIstDate(item.purchasedOn)}</dd>
        </div>
        <div>
          <dt className="eyebrow text-ink-muted">Condition</dt>
          <dd className="mt-1 font-bold capitalize">{item.condition}</dd>
        </div>
      </dl>

      {assets.length ? (
        <div className="mt-6">
          <p className="eyebrow text-ink-muted">Registered asset tags</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {assets.map((asset) => (
              <span key={asset.id} className="border border-navy/30 px-2 py-1 font-mono text-[11px] font-bold">
                {asset.assetTag}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex items-end justify-between gap-6 border-t border-navy/30 pt-4 text-[10px] uppercase tracking-[0.14em] text-ink-muted">
        <span>Physical Education Department · VARSITY</span>
        <span>Printed from the live equipment register</span>
      </div>
    </section>
  );
}
