import type { Metadata } from "next";
import Link from "next/link";
import { Phase3Header, Phase3Notice } from "@/components/phase3/common";
import { FeedbackList } from "@/components/phase3/feedback/feedback-list";
import { Button } from "@/components/ui/button";
import { getMyFeedbackRequests } from "@/lib/data/phase3-feedback";

export const metadata: Metadata = { title: "My feedback requests" };

export default async function MyFeedbackPage() {
  const requests = await getMyFeedbackRequests();

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="For students / PE department"
        title="My requests"
        description="Track your feedback, read department replies and add more information when asked."
        actions={<Button asChild variant="lime"><Link href="/feedback">New request</Link></Button>}
      />

      <Phase3Notice>
        Only your own requests are listed here. Internal PE notes are never shown in this view.
      </Phase3Notice>

      <FeedbackList requests={requests} basePath="/my-feedback" isAdmin={false} />
    </div>
  );
}
