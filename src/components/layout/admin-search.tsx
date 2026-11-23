"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

interface SearchItem {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

interface SearchGroup {
  type: string;
  label: string;
  items: SearchItem[];
}

/** Bounded, PE-admin-only search across navigation identifiers. */
export function AdminSearch() {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/admin/search?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      })
        .then((response) => (response.ok ? response.json() : { groups: [] }))
        .then((payload: { groups?: SearchGroup[] }) => {
          setGroups(payload.groups ?? []);
          setOpen(true);
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const count = groups.reduce((total, group) => total + group.items.length, 0);

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <div className="flex items-center gap-2 border border-navy/15 bg-chalk/60 px-3 py-2">
        <Search className="size-4 text-ink-muted" aria-hidden />
        <input
          type="search"
          value={query}
          aria-label="Search students, events, equipment and games"
          placeholder="Search VARSITY…"
          className="w-44 bg-transparent text-xs text-navy outline-none placeholder:text-ink-muted/70 lg:w-56"
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            if (value.trim().length < 2) {
              setGroups([]);
              setOpen(false);
            }
          }}
          onFocus={() => count ? setOpen(true) : undefined}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        />
      </div>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-h-96 overflow-y-auto border border-navy/15 bg-card shadow-xl">
          {loading ? (
            <p className="px-4 py-3 text-xs text-ink-muted">Searching…</p>
          ) : count === 0 ? (
            <p className="px-4 py-3 text-xs text-ink-muted">No matching records.</p>
          ) : (
            groups
              .filter((group) => group.items.length)
              .map((group) => (
                <div key={group.type} className="border-b border-navy/10 last:border-b-0">
                  <p className="px-4 pb-1 pt-3 text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-cobalt">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <Link
                      key={`${group.type}-${item.id}`}
                      href={item.href}
                      className="block px-4 py-2 hover:bg-navy/5"
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      <span className="block text-sm font-bold text-navy">{item.title}</span>
                      {item.subtitle ? (
                        <span className="block truncate text-[0.65rem] text-ink-muted">{item.subtitle}</span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              ))
          )}
        </div>
      ) : null}
    </div>
  );
}
