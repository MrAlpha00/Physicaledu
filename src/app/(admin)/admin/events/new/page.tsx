import type { Metadata } from "next";
import Link from "next/link";
import { EventForm } from "@/components/phase4/event-form";
import { Phase4Header } from "@/components/phase4/common";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "New sports event" };

export default function NewEventPage() {
  return (
    <div className="space-y-8">
      <Phase4Header
        kicker="Phase 4 / Events"
        title="New event"
        description="Set the event identity, dates, visibility and contact details. Competitions are added after the event is created."
        actions={<Button asChild variant="outline"><Link href="/admin/events">Back to events</Link></Button>}
      />
      <div className="border border-navy/10 bg-white p-6"><EventForm event={null} /></div>
    </div>
  );
}
