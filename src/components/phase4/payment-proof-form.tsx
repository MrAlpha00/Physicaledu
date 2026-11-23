"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitPaymentProofAction } from "@/app/(public)/events/actions";
import { Phase4ActionNotice } from "@/components/phase4/action-notice";
import { Phase4FileUploadControl } from "@/components/phase4/file-upload-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/types/domain";

export function PaymentProofForm({
  entryId,
  feeAmount = null,
  instructions = "",
  qrUrl = "",
}: {
  entryId: string;
  feeAmount?: number | null;
  instructions?: string;
  qrUrl?: string;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await submitPaymentProofAction({
        entryId,
        proofFileId: String(formData.get("proofFileId") ?? ""),
        transactionReference: String(formData.get("transactionReference") ?? ""),
        claimedAmount: feeAmount,
      });
      setNotice(result);
      if (result.status === "success") router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-4">
      <Phase4ActionNotice state={notice} />
      {instructions ? <p className="whitespace-pre-wrap text-sm text-navy">{instructions}</p> : null}
      {qrUrl ? (
        <a href={qrUrl} target="_blank" rel="noreferrer" className="inline-block border border-navy/15 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="Payment QR code" className="h-40 w-40 object-contain" />
        </a>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="transactionReference">Transaction reference</Label>
        <Input id="transactionReference" name="transactionReference" maxLength={120} placeholder="UPI reference / transaction ID" className="w-full border border-navy/20 bg-white px-3 py-2 text-sm" />
      </div>
      <Phase4FileUploadControl
        name="proofFileId"
        parentType="payment_proof"
        parentId={entryId}
        label="Payment proof"
        required
      />
      <Button type="submit" variant="lime" disabled={pending}>
        {pending ? "Submitting…" : "Submit proof for verification"}
      </Button>
    </form>
  );
}
