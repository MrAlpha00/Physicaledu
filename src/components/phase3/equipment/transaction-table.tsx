import { Phase3StatusBadge } from "@/components/phase3/common";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIstDateTime } from "@/lib/time/india";
import type { EquipmentTransactionView } from "@/types/domain";
import { TransactionActions } from "./transaction-actions";

function toneFor(status: EquipmentTransactionView["displayStatus"]) {
  switch (status) {
    case "returned":
      return "good" as const;
    case "overdue":
    case "lost":
    case "damaged":
      return "bad" as const;
    case "issued":
    case "partially_returned":
      return "info" as const;
    default:
      return "warn" as const;
  }
}

export function TransactionTable({ transactions }: { transactions: EquipmentTransactionView[] }) {
  if (transactions.length === 0) {
    return (
      <p className="border border-dashed border-navy/20 bg-white p-10 text-center text-sm text-ink-muted">
        No equipment transactions recorded yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border border-navy/10 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Equipment</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Issued (IST)</TableHead>
            <TableHead>Due (IST)</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell>
                <p className="text-sm font-bold">{transaction.itemName}</p>
                {transaction.assetTag ? (
                  <p className="mt-1 font-mono text-[11px] text-ink-muted">{transaction.assetTag}</p>
                ) : null}
              </TableCell>
              <TableCell className="text-xs">{transaction.studentName}</TableCell>
              <TableCell className="whitespace-nowrap text-xs text-ink-muted">
                {formatIstDateTime(transaction.issuedAt)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs">{formatIstDateTime(transaction.expectedReturnAt)}</TableCell>
              <TableCell className="text-xs tabular-nums">
                {transaction.quantityReturned}/{transaction.quantityIssued}
              </TableCell>
              <TableCell>
                <Phase3StatusBadge label={transaction.displayStatus} tone={toneFor(transaction.displayStatus)} />
              </TableCell>
              <TableCell>
                <TransactionActions transaction={transaction} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
