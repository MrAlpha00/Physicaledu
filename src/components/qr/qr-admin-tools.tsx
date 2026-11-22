"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, LoaderCircle, RefreshCw } from "lucide-react";
import { regenerateQr, setQrActive } from "@/app/(admin)/admin/qr-codes/actions";
import { Button } from "@/components/ui/button";
import type { QrCodeView } from "@/types/domain";

export function QrAdminTools({ codes }: { codes: QrCodeView[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function run(id: string, action: () => Promise<{ status: string; message: string }>) {
    setNotice(null);
    setPendingId(id);
    void action()
      .then((result) => {
        setNotice({ tone: result.status === "success" ? "ok" : "error", text: result.message });
        if (result.status === "success") router.refresh();
      })
      .finally(() => setPendingId(null));
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <p role="status" className={`border-l-4 p-3 text-sm ${notice.tone === "ok" ? "border-l-[#8fb63c] bg-lime/40 text-[#33521b]" : "border-l-coral bg-coral/10 text-[#8b3725]"}`}>
          {notice.text}
        </p>
      ) : null}
      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b-2 border-navy text-xs uppercase tracking-[0.08em]">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Type</th>
              <th className="p-3">Destination</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {codes.map((code) => (
              <tr key={code.id}>
                <td className="p-3 font-bold">{code.name}</td>
                <td className="p-3 text-xs">{code.qrType.replace(/_/g, " ")}</td>
                <td className="p-3 font-mono text-xs text-ink-muted">{code.destinationPath}</td>
                <td className="p-3">
                  <span
                    className={`text-xs font-bold uppercase ${code.isActive ? "text-[#4b711d]" : "text-coral-dark"}`}
                  >
                    {code.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendingId === code.id}
                      onClick={() => run(code.id, () => setQrActive(code.id, !code.isActive))}
                    >
                      {code.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendingId === code.id}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Regenerate ${code.name}? The old QR stops working immediately; download and post the new version.`,
                          )
                        ) {
                          run(code.id, () => regenerateQr(code.id));
                        }
                      }}
                    >
                      {pendingId === code.id ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                      Regenerate
                    </Button>
                    <a
                      href={`/api/qr/${code.id}?format=png`}
                      className="inline-flex h-8 items-center gap-1 border border-navy/25 px-3 text-xs font-bold uppercase tracking-[0.05em] text-navy hover:bg-navy/5"
                    >
                      <Download className="size-3" /> PNG
                    </a>
                    <a
                      href={`/api/qr/${code.id}?format=svg`}
                      className="inline-flex h-8 items-center gap-1 border border-navy/25 px-3 text-xs font-bold uppercase tracking-[0.05em] text-navy hover:bg-navy/5"
                    >
                      <Download className="size-3" /> SVG
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
