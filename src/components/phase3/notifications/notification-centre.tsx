"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BellRing, CheckCheck, ExternalLink, MailCheck } from "lucide-react";
import {
  markAllNotificationsRead,
  markNotificationRead,
  setNotificationPreference,
} from "@/app/(student)/notifications/actions";
import { Phase3StatusBadge } from "@/components/phase3/common";
import { Button } from "@/components/ui/button";
import type { NotificationCategory, NotificationChannel } from "@/types/database";
import type { ActionState, NotificationView } from "@/types/domain";
import { NotificationActionNotice } from "./action-notice";

const CATEGORIES: NotificationCategory[] = [
  "general", "attendance", "task", "calendar", "feedback",
  "equipment", "announcement", "achievement", "future_event",
];
const CHANNELS: NotificationChannel[] = ["in_app", "email"];

interface PreferenceRow {
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
}

function safeLink(value: string | null): { href: string; external: boolean } | null {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return { href: value, external: false };
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return { href: url.toString(), external: true };
  } catch {
    return null;
  }
  return null;
}

export function NotificationCentre({
  notifications,
  unreadCount,
  preferences,
}: {
  notifications: NotificationView[];
  unreadCount: number;
  preferences: PreferenceRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const visible = filter === "unread" ? notifications.filter((item) => !item.readAt) : notifications;

  function run(action: () => Promise<ActionState>, onSuccess?: () => void) {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      setNotice(result);
      if (result.status === "success") {
        onSuccess?.();
        router.refresh();
      }
    });
  }

  function isEnabled(category: NotificationCategory, channel: NotificationChannel): boolean {
    const key = `${category}:${channel}`;
    if (key in overrides) return overrides[key];
    const row = preferences.find((item) => item.category === category && item.channel === channel);
    return row ? row.enabled : true;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.45fr)]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-navy pb-2">
          <div>
            <h2 className="text-2xl font-bold">Your notifications</h2>
            <p className="mt-1 text-xs text-ink-muted">{unreadCount} unread</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filter === "unread" ? "default" : "outline"}
              onClick={() => setFilter("unread")}
            >
              Unread
            </Button>
            <Button
              type="button"
              size="sm"
              variant="lime"
              disabled={pending || unreadCount === 0}
              onClick={() => run(() => markAllNotificationsRead())}
            >
              <CheckCheck /> Mark all read
            </Button>
          </div>
        </div>

        <NotificationActionNotice state={notice} />

        <div className="space-y-3">
          {visible.length === 0 ? (
            <div className="border border-dashed border-navy/20 bg-white px-6 py-12 text-center">
              <BellRing className="mx-auto size-7 text-cobalt" />
              <p className="mt-3 text-sm font-bold text-navy">{filter === "unread" ? "Nothing unread" : "No notifications yet"}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {filter === "unread" ? "You are all caught up." : "Announcements and updates from the PE department will appear here."}
              </p>
            </div>
          ) : (
            visible.map((item) => {
              const link = safeLink(item.link);
              return (
                <article
                  key={item.id}
                  className={`border-l-4 bg-white p-5 shadow-sm ${item.readAt ? "border-l-navy/15" : "border-l-lime"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Phase3StatusBadge label={item.category} tone="info" />
                      {item.priority === "high" || item.priority === "urgent" ? (
                        <Phase3StatusBadge label={item.priority} tone="bad" />
                      ) : null}
                    </div>
                    <span className="text-[11px] text-ink-muted">{item.createdAt.slice(0, 10)}</span>
                  </div>
                  <h3 className="mt-3 font-barlow text-2xl leading-tight text-navy">{item.title}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-navy">{item.body}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {link ? (
                      link.external ? (
                        <a href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-cobalt hover:underline">
                          Open link <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <Link href={link.href} className="text-xs font-bold text-cobalt hover:underline">Open link</Link>
                      )
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant={item.readAt ? "ghost" : "outline"}
                      disabled={pending}
                      onClick={() =>
                        run(() => markNotificationRead({ notificationId: item.id, read: !item.readAt }))
                      }
                    >
                      {item.readAt ? "Mark unread" : "Mark read"}
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="border-t-4 border-t-cobalt bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <MailCheck className="size-5 text-cobalt" />
            <h2 className="text-xl font-bold">Preferences</h2>
          </div>
          <p className="mt-2 text-xs text-ink-muted">Choose how you receive each kind of update. Changes save immediately.</p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-navy/15 text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                  <th className="pb-2 font-bold">Category</th>
                  <th className="pb-2 font-bold">In app</th>
                  <th className="pb-2 font-bold">Email</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((category) => (
                  <tr key={category} className="border-b border-navy/10 last:border-0">
                    <td className="py-2 font-semibold capitalize">{category.replaceAll("_", " ")}</td>
                    {CHANNELS.map((channel) => (
                      <td key={channel} className="py-2">
                        <input
                          type="checkbox"
                          aria-label={`${channel} notifications for ${category}`}
                          className="size-4 accent-[#3564e9]"
                          checked={isEnabled(category, channel)}
                          disabled={pending}
                          onChange={(event) => {
                            const enabled = event.target.checked;
                            setOverrides((current) => ({ ...current, [`${category}:${channel}`]: enabled }));
                            run(() => setNotificationPreference({ category, channel, enabled }));
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[11px] text-ink-muted">Email delivery depends on confirmed email settings and an active account.</p>
        </div>
      </aside>
    </div>
  );
}
