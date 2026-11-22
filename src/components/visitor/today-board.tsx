"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatIstDateTime, formatIstTime } from "@/lib/time/india";
import type { PublicVisitor } from "@/types/domain";

export function TodayBoard({ visitors }: { visitors: PublicVisitor[] }) {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), 30_000);
    return () => window.clearInterval(interval);
  }, [router]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-4 border-lime pb-4">
        <div>
          <p className="eyebrow text-lime">VARSITY · Physical Education</p>
          <h1 className="mt-3 text-5xl font-bold leading-none text-chalk sm:text-7xl">
            Today&apos;s visitors
          </h1>
        </div>
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-chalk/60">
          Auto-refreshes · {formatIstDateTime(new Date())}
        </p>
      </div>

      {visitors.length === 0 ? (
        <p className="border border-dashed border-chalk/20 p-12 text-center text-2xl text-chalk/50">
          No visitors recorded yet today.
        </p>
      ) : (
        <ul className="divide-y divide-chalk/10">
          {visitors.map((visitor, index) => (
            <li
              key={`${visitor.visitedAt}-${index}`}
              className="grid grid-cols-[4rem_1fr_1fr] items-center gap-4 py-6 sm:grid-cols-[6rem_1fr_1fr_7rem]"
            >
              <span className="stat-number text-3xl text-lime sm:text-4xl">
                {formatIstTime(visitor.visitedAt).replace(/\s?(AM|PM)$/i, "")}
              </span>
              <span className="text-2xl font-bold text-chalk sm:text-3xl">{visitor.visitorLabel}</span>
              <span className="text-lg text-chalk/70 sm:text-2xl">{visitor.purposeLabel}</span>
              <span className="hidden text-right text-xs font-bold uppercase tracking-[0.1em] text-chalk/40 sm:block">
                IST
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-chalk/40">
        Privacy-safe display: first name and surname initial only. Full records are PE Admin only.
      </p>
    </div>
  );
}
