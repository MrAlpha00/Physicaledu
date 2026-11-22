import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { Phase3Header, Phase3Notice } from "@/components/phase3/common";
import { FeedbackSubmitForm } from "@/components/phase3/feedback/feedback-submit-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Send feedback" };

export default function StudentFeedbackPage() {
  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="For students / PE department"
        title="Send feedback"
        description="Report equipment issues, suggest activities or ask the PE office to review an attendance record. Every request gets its own thread."
        actions={
          <Button asChild variant="lime"><Link href="/my-feedback">My requests</Link></Button>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(320px,0.75fr)_minmax(0,1.25fr)]">
        <aside className="space-y-4">
          <Phase3Notice>
            Requests are linked to your active student directory record. Only you and PE staff can see them.
          </Phase3Notice>
          <div className="border border-navy/10 bg-white p-5 shadow-sm">
            <MessageSquareText className="size-6 text-coral" />
            <h2 className="mt-3 text-xl font-bold">What happens next?</h2>
            <ol className="mt-3 space-y-2 text-sm text-ink-muted">
              <li>1. The PE desk reviews your request and sets a priority.</li>
              <li>2. Public replies appear in your thread; internal notes stay with staff.</li>
              <li>3. You can reply at any time before a request is closed.</li>
            </ol>
          </div>
          <p className="text-xs text-ink-muted">
            For urgent safety issues, also speak to a PE staff member in person. In-app requests are not monitored in real time.
          </p>
        </aside>
        <FeedbackSubmitForm />
      </div>
    </div>
  );
}
