"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export interface NotificationItem {
  id: string;
  message: string;
  time: string;
  read: boolean;
}

export function useNotifications(userId: string, role: UserRole) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (role !== "professor" && role !== "admin") {
      setLoaded(true);
      return;
    }

    const supabase = createClient();

    async function fetchNotifications() {
      if (role === "professor") {
        const { data } = await supabase
          .from("calendar_requests")
          .select("id, title, status, updated_at")
          .eq("professor_id", userId)
          .in("status", ["approved", "rejected", "clarification_needed"])
          .order("updated_at", { ascending: false })
          .limit(10);

        if (data) {
          setItems(
            data.map((r) => ({
              id: r.id,
              message: `"${r.title}" was ${
                r.status === "clarification_needed"
                  ? "sent back for clarification"
                  : r.status
              }`,
              time: r.updated_at,
              read: false,
            }))
          );
        }
      } else if (role === "admin") {
        const { data } = await supabase
          .from("calendar_requests")
          .select(
            "id, title, status, updated_at, professor:profiles!calendar_requests_professor_id_fkey(full_name)"
          )
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(10);

        if (data) {
          setItems(
            data.map((r: unknown) => {
              const row = r as { id: string; title: string; updated_at: string; professor?: { full_name?: string } | null };
              const prof = row.professor;
              const name = prof && typeof prof === "object" && "full_name" in prof ? prof.full_name : null;
              return {
                id: row.id,
                message: `New request "${row.title}" from ${name ?? "a professor"}`,
                time: row.updated_at,
                read: false,
              };
            })
          );
        }
      }
      setLoaded(true);
    }

    fetchNotifications();

    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_requests" },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, role]);

  return { items, count: items.length, loaded };
}

export function NotificationList({
  items,
  emptyMessage = "No notifications",
  maxHeight = "12rem",
  showViewAll = true,
}: {
  items: NotificationItem[];
  emptyMessage?: string;
  maxHeight?: string;
  showViewAll?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <div className="px-3 py-2 border-b bg-muted/30">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Notifications
        </p>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight }}>
        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <>
            {items.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/50 transition-colors"
              >
                <p className="text-sm leading-snug">{item.message}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(item.time), { addSuffix: true })}
                </p>
              </div>
            ))}
            {showViewAll && items.length > 0 && (
              <Link
                href="/dashboard"
                className="block px-3 py-2.5 text-sm font-medium text-primary hover:bg-muted/50 transition-colors text-center"
              >
                View dashboard
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
