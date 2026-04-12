"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ADMIN_DASHBOARD_SECTIONS,
  ADMIN_REQUEST_SUBTABS,
  normalizeAdminEmail,
  sectionLabelForValue,
  type DashboardNavGroup,
} from "@/lib/admin-request-routing";
import type { AdminRequestRouting } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";

export function AdminRequestRoutingPanel() {
  const [rows, setRows] = useState<AdminRequestRouting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftKeys, setDraftKeys] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("admin_request_routing")
      .select("*")
      .order("admin_email", { ascending: true })
      .order("request_type_key", { ascending: true });
    if (error) {
      toast.error("Could not load routing: " + error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as AdminRequestRouting[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byEmail = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of rows) {
      const list = m.get(r.admin_email) ?? [];
      list.push(r.request_type_key);
      m.set(r.admin_email, list);
    }
    return m;
  }, [rows]);

  const filteredEntries = useMemo(() => {
    const entries = [...byEmail.entries()].sort(([a], [b]) => a.localeCompare(b));
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(([email]) => email.toLowerCase().includes(q));
  }, [byEmail, search]);

  function openAddDialog() {
    setDialogMode("add");
    setDraftEmail("");
    setDraftKeys(new Set());
    setDialogOpen(true);
  }

  function openEditDialog(email: string) {
    const norm = normalizeAdminEmail(email);
    setDialogMode("edit");
    setDraftEmail(norm);
    setDraftKeys(new Set(byEmail.get(norm) ?? []));
    setDialogOpen(true);
  }

  function toggleKey(key: string) {
    setDraftKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectGroupAll(group: DashboardNavGroup) {
    const keys = ADMIN_DASHBOARD_SECTIONS.filter((s) => s.navGroup === group).map((s) => s.value);
    setDraftKeys((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.add(k);
      return next;
    });
  }

  function clearGroup(group: DashboardNavGroup) {
    const keys = ADMIN_DASHBOARD_SECTIONS.filter((s) => s.navGroup === group).map((s) => s.value);
    setDraftKeys((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.delete(k);
      return next;
    });
  }

  async function saveDraft() {
    const norm = normalizeAdminEmail(draftEmail);
    if (!norm || !norm.includes("@")) {
      toast.error("Enter a valid admin email.");
      return;
    }
    if (dialogMode === "add" && byEmail.has(norm)) {
      toast.error("This email already has access. Use Edit on the row below.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: delErr } = await supabase.from("admin_request_routing").delete().eq("admin_email", norm);
    if (delErr) {
      toast.error("Failed to update: " + delErr.message);
      setSaving(false);
      return;
    }
    const keys = [...draftKeys];
    if (keys.length > 0) {
      const insertRows = keys.map((request_type_key) => ({
        admin_email: norm,
        request_type_key,
      }));
      const { error: insErr } = await supabase.from("admin_request_routing").insert(insertRows);
      if (insErr) {
        toast.error("Failed to save: " + insErr.message);
        setSaving(false);
        return;
      }
    }
    toast.success(
      keys.length
        ? `Saved access for ${norm} (${keys.length} section${keys.length === 1 ? "" : "s"}).`
        : `Removed all access for ${norm}.`
    );
    setSaving(false);
    setDialogOpen(false);
    await load();
  }

  async function removeAdmin(email: string) {
    const norm = normalizeAdminEmail(email);
    if (!window.confirm(`Remove all access for ${norm}?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("admin_request_routing").delete().eq("admin_email", norm);
    if (error) {
      toast.error("Failed to remove: " + error.message);
      return;
    }
    toast.success(`Removed access for ${norm}.`);
    if (dialogOpen && normalizeAdminEmail(draftEmail) === norm) {
      setDialogOpen(false);
    }
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading Admin Access…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Admins</CardTitle>
            <CardDescription>
              Tick the pages this admin can use. Until you save, they see nothing.
            </CardDescription>
          </div>
          <Button type="button" onClick={openAddDialog} className="shrink-0 gap-1.5">
            <Plus className="h-4 w-4" />
            Add admin
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by email…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search admins"
            />
          </div>

          {byEmail.size === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
              <UserRound className="mb-3 h-10 w-10 text-muted-foreground/60" />
              <p className="text-sm font-medium text-foreground">No admins configured yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Other admins won&apos;t see any sidebar pages until you add them here.
              </p>
              <Button type="button" className="mt-4 gap-1.5" onClick={openAddDialog}>
                <Plus className="h-4 w-4" />
                Add admin
              </Button>
            </div>
          ) : filteredEntries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No emails match your search.</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {filteredEntries.map(([email, keys]) => (
                <li
                  key={email}
                  className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="font-medium text-foreground break-all">{email}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="font-normal">
                        {keys.length} section{keys.length === 1 ? "" : "s"}
                      </Badge>
                      {keys.slice(0, 4).map((k) => (
                        <Badge key={k} variant="outline" className="max-w-[200px] truncate font-normal">
                          {sectionLabelForValue(k)}
                        </Badge>
                      ))}
                      {keys.length > 4 ? (
                        <Badge variant="outline" className="font-normal">
                          +{keys.length - 4} more
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => openEditDialog(email)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:bg-destructive/10"
                      onClick={() => void removeAdmin(email)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="flex max-h-[min(90vh,640px)] max-w-lg flex-col gap-0 p-0 sm:max-w-lg"
          showCloseButton
        >
          <DialogHeader className="border-b px-4 py-4 text-left">
            <DialogTitle>{dialogMode === "add" ? "Add admin" : "Edit access"}</DialogTitle>
            <DialogDescription>
              {dialogMode === "edit"
                ? "Update which sidebar pages this person can open."
                : "Enter their email and choose which pages they can use."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="access-email">Email</Label>
              <Input
                id="access-email"
                type="email"
                autoComplete="email"
                placeholder="name@school.edu"
                value={draftEmail}
                onChange={(e) => setDraftEmail(e.target.value)}
                disabled={dialogMode === "edit"}
                className={dialogMode === "edit" ? "bg-muted/50" : undefined}
              />
              {dialogMode === "edit" ? (
                <p className="text-xs text-muted-foreground">Email can&apos;t be changed here.</p>
              ) : null}
            </div>

            <Separator className="my-5" />

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Requests</p>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => selectGroupAll("requests")}
                  >
                    All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => clearGroup("requests")}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {ADMIN_REQUEST_SUBTABS.map((tab) => (
                  <li key={tab.value}>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/80 bg-muted/15 px-3 py-2.5 text-sm transition-colors hover:bg-muted/35 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border-input"
                        checked={draftKeys.has(tab.value)}
                        onChange={() => toggleKey(tab.value)}
                      />
                      <span className="leading-snug">{tab.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <Separator className="my-5" />

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Management</p>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => selectGroupAll("main")}
                  >
                    All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => clearGroup("main")}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {ADMIN_DASHBOARD_SECTIONS.filter((s) => s.navGroup === "main").map((tab) => (
                  <li key={tab.value}>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/80 bg-muted/15 px-3 py-2.5 text-sm transition-colors hover:bg-muted/35 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border-input"
                        checked={draftKeys.has(tab.value)}
                        onChange={() => toggleKey(tab.value)}
                      />
                      <span className="leading-snug">{tab.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/30 px-4 py-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveDraft()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
