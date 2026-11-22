import { Badge } from "@/components/ui/badge";
import type {
  AccountStatus,
  MembershipStatus,
  VerificationStatus,
} from "@/types/database";

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const map = {
    verified: { label: "Verified", variant: "lime" as const },
    pending: { label: "Pending verification", variant: "coral" as const },
    suspended: { label: "Suspended", variant: "muted" as const },
  };
  const entry = map[status];
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return (
    <Badge variant={status === "active" ? "default" : "muted"}>
      {status === "active" ? "Active account" : "Suspended account"}
    </Badge>
  );
}

export function MembershipBadge({ status }: { status: MembershipStatus | null }) {
  if (!status || status === "inactive") {
    return <Badge variant="muted">Not enrolled</Badge>;
  }
  return <Badge variant="cobalt">PE student</Badge>;
}
