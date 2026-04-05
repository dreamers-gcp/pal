"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Parcel, Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { Package, Loader2 } from "lucide-react";

export function UserParcelTab({ profile }: { profile: Profile }) {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const fetchParcels = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("parcels")
      .select("*")
      .eq("recipient_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Could not load parcels: " + error.message);
      setParcels([]);
    } else {
      setParcels((data as Parcel[]) ?? []);
    }
    setLoading(false);
  }, [profile.id]);

  useEffect(() => {
    fetchParcels();
  }, [fetchParcels]);

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
      .eq("id", parcel.id)
      .eq("recipient_id", profile.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Marked as collected");
      fetchParcels();
    }
    setMarkingId(null);
  }

  const awaiting = parcels.filter((p) => p.status === "awaiting_pickup");
  const past = parcels.filter((p) => p.status === "collected");

  return (
    <div className="space-y-6">
      {!profile.mobile_phone?.trim() && (
        <Card className="border-amber-200/80 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Add your mobile for parcels</CardTitle>
            <CardDescription>
              Parcel matching uses the mobile number on your account. Contact admin if you signed up
              before mobile was required, or ask to have your profile updated.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-[#01696f]" />
            Awaiting collection
          </CardTitle>
          <CardDescription>
            Parcels registered at the desk with your mobile number ({profile.mobile_phone || "not set"}
            ).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : awaiting.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing waiting for you right now.</p>
          ) : (
            <ul className="space-y-3">
              {awaiting.map((p) => (
                <li
                  key={p.id}
                  className="rounded-lg border border-[#01696f]/25 bg-[#01696f]/[0.06] p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Badge className="mb-2 bg-amber-500 text-amber-950 hover:bg-amber-500">
                        Pick up at parcel desk
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        Registered {format(new Date(p.created_at), "MMM d, yyyy h:mm a")}
                      </p>
                      {p.notes && (
                        <p className="mt-2 text-sm">
                          <span className="text-muted-foreground">Note: </span>
                          {p.notes}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 border-[#01696f]/40"
                      disabled={markingId === p.id}
                      onClick={() => markCollected(p)}
                    >
                      {markingId === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "I've collected it"
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Past parcels</CardTitle>
          <CardDescription>Previously collected items.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : past.length === 0 ? (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {past.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 py-2 last:border-0"
                >
                  <span className="text-muted-foreground">
                    Registered {format(new Date(p.created_at), "MMM d, yyyy")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Collected{" "}
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
