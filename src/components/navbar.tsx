"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, LayoutDashboard, Menu } from "lucide-react";
import { useNotifications, NotificationList } from "@/components/notifications";
import { cn } from "@/lib/utils";

const roleBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  admin: "destructive",
  professor: "default",
  student: "secondary",
};

function TabMenuButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("pal:open-tab-menu"))}
      className={className}
      aria-label="Open tab menu"
      title="Open menu"
    >
      <Menu className="h-4 w-4" />
    </button>
  );
}

export function Navbar() {
  const { profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(false);
  /** Wide labels vs narrow icon rail; synced from dashboard via `pal:section-nav-expanded`. */
  const [dashRailWide, setDashRailWide] = useState(true);
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

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    function sync() {
      setIsMobileNav(mq.matches);
    }
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    function onRail(e: Event) {
      const d = (e as CustomEvent<{ wide?: boolean; expanded?: boolean }>).detail;
      if (typeof d?.wide === "boolean") setDashRailWide(d.wide);
      else if (typeof d?.expanded === "boolean") setDashRailWide(d.expanded);
    }
    window.addEventListener("pal:section-nav-expanded", onRail);
    return () => window.removeEventListener("pal:section-nav-expanded", onRail);
  }, []);

  const isDashboardRoute = pathname?.startsWith("/dashboard") ?? false;
  const dashboardDesktopNav =
    Boolean(profile) && isDashboardRoute && !isMobileNav;

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

  const tabMenuBtnClass =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[rgba(0,0,0,0.08)] bg-white text-foreground/70 transition-colors hover:border-[rgba(0,0,0,0.12)] hover:bg-[rgba(0,0,0,0.03)] hover:text-foreground";

  const logoLink = (
    <Link
      href="/"
      className={cn(
        "flex items-center justify-center gap-2 no-underline text-foreground transition-opacity hover:opacity-85",
        dashboardDesktopNav ? "min-w-0 shrink" : "shrink-0"
      )}
    >
      <img
        src="/planova-logo.png"
        alt="Planova"
        height={32}
        className={cn(
          "m-0 block w-auto border-0 bg-transparent object-contain object-center p-0 select-none",
          dashboardDesktopNav && !dashRailWide
            ? "h-7 max-h-7 max-w-[28px]"
            : "h-[32px] max-h-[32px] object-left"
        )}
        style={{
          display: "block",
          height: dashboardDesktopNav && !dashRailWide ? "28px" : "32px",
          width: "auto",
        }}
        draggable={false}
      />
    </Link>
  );

  const accountMenu =
    profile ? (
      <>
        <Badge
          variant={roleBadgeVariant[profile.role] ?? "outline"}
          className="hidden md:inline-flex"
        >
          {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
        </Badge>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="relative flex h-9 w-9 items-center justify-center rounded-full outline-none transition-colors hover:bg-[rgba(0,0,0,0.05)] focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Account menu"
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-sm text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            {(profile.role === "professor" || profile.role === "admin") &&
              notificationsLoaded &&
              notificationCount > 0 && (
                <span
                  className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-white"
                  aria-label={`${notificationCount} notifications`}
                />
              )}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white text-popover-foreground shadow-lg">
              {isMobileNav && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    window.dispatchEvent(new CustomEvent("pal:open-tab-menu"));
                  }}
                  className="flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-[rgba(0,0,0,0.04)]"
                >
                  <Menu className="h-4 w-4 shrink-0 text-muted-foreground" />
                  Dashboard menu
                </button>
              )}
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
                  <p className="truncate text-sm font-medium">{profile.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
                </div>
                <div className="my-1 h-px bg-border" />
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-popover-foreground no-underline transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <LayoutDashboard className="h-4 w-4 shrink-0" />
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    handleSignOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </>
    ) : null;

  const dashboardLinkNav = (
    <nav className="hidden min-w-0 flex-1 justify-center px-4 md:flex" aria-label="Main">
      {profile ? (
        <Link
          href="/dashboard"
          className="text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-foreground"
        >
          Dashboard
        </Link>
      ) : null}
    </nav>
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex h-16 w-full border-b border-[rgba(0,0,0,0.06)] bg-white",
        dashboardDesktopNav
          ? "items-stretch justify-start px-0"
          : "items-center justify-between px-[clamp(1.5rem,5vw,4rem)]"
      )}
      style={{ minHeight: "64px", height: "64px" }}
    >
      {dashboardDesktopNav ? (
        <>
          <div
            className={cn(
              "flex h-full shrink-0 items-center border-r border-[rgba(0,0,0,0.06)] bg-white transition-[width] duration-200 ease-out",
              dashRailWide ? "w-56 justify-center px-3 sm:justify-start" : "w-14 justify-center px-0"
            )}
          >
            {logoLink}
          </div>
          <div className="flex h-full min-w-0 flex-1 items-center justify-between gap-3 px-4 pr-[clamp(1.5rem,5vw,4rem)]">
            {dashboardLinkNav}
            <div className="flex shrink-0 items-center gap-2 md:gap-3">{accountMenu}</div>
          </div>
        </>
      ) : (
        <>
          <div className="flex min-w-0 items-center gap-2">
            {logoLink}
            {profile && !isDashboardRoute ? (
              <TabMenuButton className={`${tabMenuBtnClass} hidden md:inline-flex`} />
            ) : null}
          </div>
          {dashboardLinkNav}
          <div className="flex shrink-0 items-center gap-2 md:gap-3">{accountMenu}</div>
        </>
      )}
    </header>
  );
}
