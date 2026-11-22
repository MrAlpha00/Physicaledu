import type { Metadata } from "next";
import { getPublicTodayVisitors } from "@/lib/data/visitors";
import { TodayBoard } from "@/components/visitor/today-board";

export const metadata: Metadata = { title: "Today's visitors" };
export const dynamic = "force-dynamic";

export default async function TodayVisitorsPage() {
  const visitors = await getPublicTodayVisitors();
  return (
    <div className="min-h-[calc(100vh-8rem)] bg-navy px-5 py-8 sm:px-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <TodayBoard visitors={visitors} />
      </div>
    </div>
  );
}
