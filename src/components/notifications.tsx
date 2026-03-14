"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CalendarRequest, UserRole } from "@/lib/types";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface NotificationsProps {
  userId: string;
  role: UserRole;
}

interface NotificationItem {
  id: string;
  message: string;
  time: string;
  read: boolean;
}

export function Notifications({ userId, role }: NotificationsProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
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
            data.map((r: any) => ({
              id: r.id,
              message: `New request "${r.title}" from ${
                r.professor?.full_name ?? "a professor"
              }`,
              time: r.updated_at,
              read: false,
            }))
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

  const unreadCount = items.length;

  function handleOpen() {
    setOpen((prev) => !prev);
  }

  if (!loaded) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={handleOpen}
        className="relative h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Notifications"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-popover text-popover-foreground shadow-lg z-50">
          <div className="px-3 py-2 border-b">
            <p className="text-sm font-semibold">Notifications</p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                No notifications
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/50 transition-colors"
                >
                  <p className="text-sm leading-snug">{item.message}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(item.time), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
