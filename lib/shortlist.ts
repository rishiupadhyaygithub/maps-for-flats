"use client";

import { useState, useEffect, useCallback } from "react";
import type { Listing } from "./types";

const IDS_KEY  = "maps_shortlist";
const DATA_KEY = "maps_shortlist_data";

export function useShortlist() {
  const [ids, setIds] = useState<Set<string>>(new Set());

  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(IDS_KEY);
      if (stored) setIds(new Set(JSON.parse(stored) as string[]));
    } catch {}
  }, []);

  const toggle = useCallback((listing: Listing) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(listing.id)) {
        next.delete(listing.id);
        // Remove from data store too
        try {
          const all: Listing[] = JSON.parse(localStorage.getItem(DATA_KEY) || "[]");
          localStorage.setItem(DATA_KEY, JSON.stringify(all.filter((l) => l.id !== listing.id)));
        } catch {}
      } else {
        next.add(listing.id);
        // Upsert full listing object
        try {
          const all: Listing[] = JSON.parse(localStorage.getItem(DATA_KEY) || "[]");
          const deduped = all.filter((l) => l.id !== listing.id);
          localStorage.setItem(DATA_KEY, JSON.stringify([...deduped, listing]));
        } catch {}
      }
      try {
        localStorage.setItem(IDS_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);

  const isShortlisted = useCallback((id: string) => ids.has(id), [ids]);

  const getAll = useCallback((): Listing[] => {
    try {
      const all: Listing[] = JSON.parse(localStorage.getItem(DATA_KEY) || "[]");
      return all.filter((l) => ids.has(l.id));
    } catch {
      return [];
    }
  }, [ids]);

  return { toggle, isShortlisted, count: ids.size, getAll };
}
