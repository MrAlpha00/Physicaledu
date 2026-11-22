import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Inbox, MessageSquare, Wrench } from "lucide-react";
import { Phase3Header, Phase3Metric, Phase3Notice } from "@/components/phase3/common";
import { FeedbackList } from "@/components/phase3/feedback/feedback-list";
import { Button } from "@/components/ui/button";
import { getAdminFeedbackRequests, getPendingFeedbackCount } from "@/lib/data/phase3-feedback";

export const metadata: Metadata = { title: "Feedback desk" };

export default async function AdminFeedbackPage() {
  const [requests, pendingCount] = await Promise.all([
    getAdminFeedbackRequests(),
    getPendingFeedbackCount(),
  ]);
  const urgent = requests.filter((request) => request.priority === "urgent" && !["resolved", "rejected", "closed"].includes(request.status)).length;
  const damage = requests.filter((request) => request.category === "equipment_damage").length;

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="Phase 3 / Department management"
        title="Feedback desk"
        description="Student suggestions, complaints, equipment issues and attendance corrections. Internal notes stay visible to PE staff only."
        actions={
          <Button asChild variant="outline" className="border-chalk/40 text-chalk hover:bg-chalk/10 hover:text-chalk">
            <Link href="/admin/equipment/maintenance">Maintenance desk</Link>
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Feedback summary">
        <Phase3Metric label="Total requests" value={requests.length} detail="All time" icon={Inbox} />
        <Phase3Metric label="Awaiting action" value={pendingCount} detail="Not resolved, rejected or closed" icon={MessageSquare} tone="cobalt" />
        <Phase3Metric label="Urgent & open" value={urgent} detail="Needs an early response" icon={AlertTriangle} tone="coral" />
        <Phase3Metric label="Equipment damage" value={damage} detail="Link to maintenance via the request id" icon={Wrench} tone="lime" />
      </section>

      <Phase3Notice tone="warning">
        Equipment-damage requests can be linked to a maintenance record by passing the feedback request id as the source id on
        the maintenance desk. Open a damage request to copy it.
      </Phase3Notice>

      <FeedbackList requests={requests} basePath="/admin/feedback" isAdmin />
    </div>
  );
}
