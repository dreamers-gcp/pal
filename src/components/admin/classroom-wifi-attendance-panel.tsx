"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Classroom } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Wifi } from "lucide-react";

type RowState = {
  ssid: string;
  bssid: string;
  saving: boolean;
};

/**
 * Admin: set expected SSID/BSSID per classroom. When either is set, students (mobile) must
 * match after face verification or the insert is rejected (DB trigger).
 */
export function ClassroomWifiAttendancePanel() {
  const supabase = createClient();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, RowState>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("classrooms").select("*").order("name");
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as Classroom[];
    setClassrooms(list);
    const next: Record<string, RowState> = {};
    for (const c of list) {
      next[c.id] = {
        ssid: c.attendance_wifi_ssid ?? "",
        bssid: c.attendance_wifi_bssid ?? "",
        saving: false,
      };
    }
    setDrafts(next);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveRow(classroomId: string) {
    const d = drafts[classroomId];
    if (!d) return;
    setDrafts((prev) => ({
      ...prev,
      [classroomId]: { ...prev[classroomId]!, saving: true },
    }));
    const ssid = d.ssid.trim() || null;
    const bssid = d.bssid.trim() || null;
    const { error } = await supabase
      .from("classrooms")
      .update({
        attendance_wifi_ssid: ssid,
        attendance_wifi_bssid: bssid,
      })
      .eq("id", classroomId);
    setDrafts((prev) => ({
      ...prev,
      [classroomId]: { ...prev[classroomId]!, saving: false },
    }));
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Room Wi‑Fi saved.");
    await load();
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wifi className="h-5 w-5" />
          Attendance Wi‑Fi (per room)
        </CardTitle>
        <CardDescription>
          For each venue, optionally set the SSID and/or BSSID students must be on when marking
          attendance (with face match). Leave both empty to only require face verification for that
          room. BSSID is the access point MAC (e.g. <code className="text-xs">aa:bb:cc:dd:ee:ff</code>
          ).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {classrooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No classrooms in the database.</p>
        ) : (
          classrooms.map((c) => {
            const d = drafts[c.id] ?? { ssid: "", bssid: "", saving: false };
            return (
              <div
                key={c.id}
                className="rounded-lg border bg-muted/20 p-4 space-y-3"
              >
                <p className="font-medium text-sm">{c.name}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`ssid-${c.id}`}>Expected SSID</Label>
                    <Input
                      id={`ssid-${c.id}`}
                      placeholder="e.g. Campus-Classroom-A"
                      value={d.ssid}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [c.id]: { ...d, ssid: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`bssid-${c.id}`}>Expected BSSID (optional)</Label>
                    <Input
                      id={`bssid-${c.id}`}
                      placeholder="aa:bb:cc:dd:ee:ff"
                      value={d.bssid}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [c.id]: { ...d, bssid: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={d.saving}
                  onClick={() => saveRow(c.id)}
                >
                  {d.saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
