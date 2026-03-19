"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, LogOut, LayoutDashboard } from "lucide-react";
import { useNotifications, NotificationList } from "@/components/notifications";

const roleBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  admin: "destructive",
  professor: "default",
  student: "secondary",
};

export function Navbar() {
  const { profile } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { items: notificationItems, count: notificationCount, loaded: notificationsLoaded } =
    useNotifications(profile?.id ?? "", profile?.role ?? "student");

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 no-underline text-foreground hover:opacity-80 transition-opacity"
        >
          <Calendar className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">PAL</span>
        </Link>

        {profile && (
          <div className="flex items-center gap-3">
            <Badge variant={roleBadgeVariant[profile.role] ?? "outline"}>
              {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
            </Badge>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((prev) => !prev)}
                className="relative h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Account menu"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {(profile.role === "professor" || profile.role === "admin") &&
                  notificationsLoaded &&
                  notificationCount > 0 && (
                    <span
                      className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background"
                      aria-label={`${notificationCount} notifications`}
                    />
                  )}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border bg-popover text-popover-foreground shadow-lg z-50 overflow-hidden">
                  {(profile.role === "professor" || profile.role === "admin") && (
                    <>
                      <NotificationList
                        items={notificationItems}
                        maxHeight="11rem"
                        showViewAll
                      />
                      <div className="h-px bg-border" />
                    </>
                  )}
                  <div className="p-2">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium truncate">{profile.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                    </div>
                    <div className="h-px bg-border my-1" />
                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm no-underline text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <LayoutDashboard className="h-4 w-4 shrink-0" />
                      Dashboard
                    </Link>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        handleSignOut();
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
