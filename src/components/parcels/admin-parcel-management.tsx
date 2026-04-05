"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Parcel, Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { normalizeTenDigitMobile, mobileFieldError } from "@/lib/phone-normalize";
import { format } from "date-fns";
import { Package, Loader2, Search } from "lucide-react";

type ParcelDateSort = "newest" | "oldest";

function matchesParcelSearch(p: Parcel, q: string): boolean {
  if (!q) return true;
  const n = (p.recipient?.full_name ?? "").toLowerCase();
  const e = (p.recipient?.email ?? "").toLowerCase();
  const m = p.mobile_snapshot.toLowerCase();
  const nt = (p.notes ?? "").toLowerCase();
  return n.includes(q) || e.includes(q) || m.includes(q) || nt.includes(q);
}

function sortParcelsByRegistered(list: Parcel[], sort: ParcelDateSort): Parcel[] {
  const out = [...list];
  if (sort === "oldest") {
    out.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  } else {
    out.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  return out;
}

function sortParcelsByCollected(list: Parcel[], sort: ParcelDateSort): Parcel[] {
  const out = [...list];
  const collectedTs = (p: Parcel) =>
    p.collected_at ? new Date(p.collected_at).getTime() : 0;
  if (sort === "oldest") {
    out.sort((a, b) => collectedTs(a) - collectedTs(b));
  } else {
    out.sort((a, b) => collectedTs(b) - collectedTs(a));
  }
  return out;
}

export function AdminParcelManagement({ adminProfile }: { adminProfile: Profile }) {
  const [mobileInput, setMobileInput] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [awaitingSearch, setAwaitingSearch] = useState("");
  const [awaitingSort, setAwaitingSort] = useState<ParcelDateSort>("newest");
  const [collectedSearch, setCollectedSearch] = useState("");
  const [collectedSort, setCollectedSort] = useState<ParcelDateSort>("newest");

  const fetchParcels = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("parcels")
      .select(
        "*, recipient:profiles!parcels_recipient_id_fkey(id, full_name, email, role, mobile_phone)"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Could not load parcels: " + error.message);
      setParcels([]);
    } else {
      setParcels((data as Parcel[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchParcels();
  }, [fetchParcels]);

  async function registerParcel(e: React.FormEvent) {
    e.preventDefault();
    const err = mobileFieldError(mobileInput);
    if (err) {
      toast.error(err);
      return;
    }
    const normalized = normalizeTenDigitMobile(mobileInput)!;

    setSubmitting(true);
    const supabase = createClient();
    const { data: recipient, error: findErr } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, mobile_phone")
      .in("role", ["student", "professor"])
      .eq("mobile_phone", normalized)
      .maybeSingle();

    if (findErr) {
      toast.error(findErr.message);
      setSubmitting(false);
      return;
    }
    if (!recipient) {
      toast.error(
        "No student or professor found with this mobile. They must sign up with the same 10-digit number."
      );
      setSubmitting(false);
      return;
    }

    const { error: insErr } = await supabase.from("parcels").insert({
      recipient_id: recipient.id,
      mobile_snapshot: normalized,
      registered_by: adminProfile.id,
      notes: notes.trim() || null,
      status: "awaiting_pickup",
    });

    if (insErr) {
      toast.error(insErr.message);
      setSubmitting(false);
      return;
    }

    toast.success(`Parcel registered for ${recipient.full_name || recipient.email}`);
    setMobileInput("");
    setNotes("");
    fetchParcels();
    setSubmitting(false);
  }

  async function markCollected(parcel: Parcel) {
    setMarkingId(parcel.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("parcels")
      .update({
        status: "collected",
        collected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", parcel.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Marked as collected");
      fetchParcels();
    }
    setMarkingId(null);
  }

  const awaiting = parcels.filter((p) => p.status === "awaiting_pickup");
  const collected = parcels.filter((p) => p.status === "collected");

  const awaitingFiltered = useMemo(() => {
    const q = awaitingSearch.trim().toLowerCase();
    const filtered = q ? awaiting.filter((p) => matchesParcelSearch(p, q)) : awaiting;
    return sortParcelsByRegistered(filtered, awaitingSort);
  }, [awaiting, awaitingSearch, awaitingSort]);

  const collectedFiltered = useMemo(() => {
    const q = collectedSearch.trim().toLowerCase();
    const filtered = q ? collected.filter((p) => matchesParcelSearch(p, q)) : collected;
    return sortParcelsByCollected(filtered, collectedSort);
  }, [collected, collectedSearch, collectedSort]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-[#01696f]" />
            Register incoming parcel
          </CardTitle>
          <CardDescription>
            Enter the 10-digit mobile number printed on the parcel. The recipient must use that same
            number on their account (signup). They will see the parcel under Parcels until it is
            collected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={registerParcel} className="max-w-md space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parcel-mobile">Mobile on parcel</Label>
              <Input
                id="parcel-mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="Digits from the shipping label"
                value={mobileInput}
                onChange={(e) => setMobileInput(e.target.value)}
                maxLength={14}
              />
              <p className="text-xs text-muted-foreground">
                10 digits; optional +91 or leading 0 is accepted.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="parcel-notes">Note (optional)</Label>
              <Textarea
                id="parcel-notes"
                rows={2}
                placeholder="Courier name, shelf, tracking…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting} className="bg-[#01696f] hover:bg-[#015a5f]">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering…
                </>
              ) : (
                "Register parcel"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Awaiting pickup</CardTitle>
          <CardDescription>
            Hand over the parcel, then mark collected here (or the recipient can confirm in their
            dashboard).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search name, email, mobile, notes…"
                value={awaitingSearch}
                onChange={(e) => setAwaitingSearch(e.target.value)}
                className="pl-8"
                aria-label="Search awaiting parcels"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:w-44">
              <Label htmlFor="awaiting-sort" className="text-sm font-medium text-foreground">
                Sort
              </Label>
              <Select
                value={awaitingSort}
                onValueChange={(v) => setAwaitingSort(v as ParcelDateSort)}
              >
                <SelectTrigger id="awaiting-sort" className="w-full min-w-0">
                  <SelectValue>
                    {awaitingSort === "newest" ? "Newest" : "Oldest"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : awaiting.length === 0 ? (
            <p className="text-sm text-muted-foreground">No parcels waiting for pickup.</p>
          ) : awaitingFiltered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No parcels match your search.</p>
          ) : (
            <ul className="space-y-3">
              {awaitingFiltered.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-2 rounded-lg border border-amber-200/80 bg-amber-50/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">
                      {p.recipient?.full_name ?? "Unknown"}{" "}
                      <span className="text-muted-foreground font-normal">
                        ({p.recipient?.role})
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Mobile {p.mobile_snapshot} · Registered{" "}
                      {format(new Date(p.created_at), "MMM d, yyyy h:mm a")}
                    </p>
                    {p.notes && (
                      <p className="text-sm text-muted-foreground">{p.notes}</p>
                    )}
                    <Badge variant="secondary" className="w-fit bg-amber-100 text-amber-950">
                      Awaiting pickup
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={markingId === p.id}
                    onClick={() => markCollected(p)}
                  >
                    {markingId === p.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Mark collected"
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recently collected</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search name, email, mobile, notes…"
                value={collectedSearch}
                onChange={(e) => setCollectedSearch(e.target.value)}
                className="pl-8"
                aria-label="Search collected parcels"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:w-44">
              <Label htmlFor="collected-sort" className="text-sm font-medium text-foreground">
                Sort
              </Label>
              <Select
                value={collectedSort}
                onValueChange={(v) => setCollectedSort(v as ParcelDateSort)}
              >
                <SelectTrigger id="collected-sort" className="w-full min-w-0">
                  <SelectValue>
                    {collectedSort === "newest" ? "Newest" : "Oldest"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : collected.length === 0 ? (
            <p className="text-sm text-muted-foreground">No collected parcels yet.</p>
          ) : collectedFiltered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No parcels match your search.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {collectedFiltered.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 py-2 last:border-0"
                >
                  <span>
                    <span className="font-medium">{p.recipient?.full_name ?? "—"}</span>{" "}
                    <span className="text-muted-foreground">· {p.mobile_snapshot}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.collected_at
                      ? format(new Date(p.collected_at), "MMM d, yyyy h:mm a")
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
