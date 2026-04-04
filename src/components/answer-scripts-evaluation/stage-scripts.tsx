"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScriptRow } from "./types";

function newScriptId() {
  return `script-${Math.random().toString(36).slice(2, 10)}`;
}

function mockMeta(fileName: string): { name: string; roll: string; pages: number } {
  const base = fileName.replace(/\.pdf$/i, "");
  const parts = base.split(/[_\s-]+/).filter(Boolean);
  let name = "Unknown student";
  let roll = "—";
  if (parts.length >= 2) {
    roll = parts[parts.length - 1] ?? roll;
    name = parts.slice(0, -1).join(" ").replace(/\b\w/g, (c) => c.toUpperCase()) || name;
  }
  const pages = 2 + (base.length % 6);
  return { name, roll, pages };
}

export function StageScripts({
  scripts,
  setScripts,
  totalExpected,
  onBack,
  onStartEvaluation,
}: {
  scripts: ScriptRow[];
  setScripts: Dispatch<SetStateAction<ScriptRow[]>>;
  totalExpected: number;
  onBack: () => void;
  onStartEvaluation: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const added: ScriptRow[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) continue;
      const meta = mockMeta(f.name);
      const id = newScriptId();
      const objectUrl = URL.createObjectURL(f);
      added.push({
        id,
        fileName: f.name,
        studentName: meta.name,
        rollNo: meta.roll,
        pages: meta.pages,
        status: "parsing",
        objectUrl,
      });
    }
    if (added.length === 0) return;
    setScripts((prev) => [...prev, ...added]);
    for (const row of added) {
      window.setTimeout(() => {
        setScripts((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, status: "ready" as const } : r))
        );
      }, 450 + Math.floor(Math.random() * 400));
    }
  }

  function updateRow(id: string, patch: Partial<Pick<ScriptRow, "studentName" | "rollNo">>) {
    setScripts((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const readyCount = scripts.filter((s) => s.status === "ready").length;
  const canStart = readyCount >= 1;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Student answer scripts</CardTitle>
          <CardDescription>
            Step 3 — upload scanned PDFs. Detection columns are simulated from filenames.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <input
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="sr-only"
            id="ae-scripts-pdf"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <label
            htmlFor="ae-scripts-pdf"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors",
              dragOver
                ? "border-[#01696f] bg-[#01696f]/[0.08]"
                : "border-muted-foreground/25 bg-muted/20 hover:border-[#01696f]/40"
            )}
          >
            <Upload className="mb-2 h-9 w-9 text-[#01696f]/70" />
            <p className="text-sm font-medium">Drop multiple script PDFs here</p>
            <p className="mt-1 text-xs text-muted-foreground">or click to browse</p>
          </label>

          <div className="rounded-lg border bg-[#01696f]/[0.06] px-4 py-3 text-sm">
            <span className="font-semibold text-[#01696f]">{readyCount}</span>
            <span className="text-muted-foreground">
              {" "}
              of {totalExpected} scripts uploaded (expected count from exam total is illustrative)
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">File name</th>
                  <th className="px-3 py-2 font-medium">Detected name</th>
                  <th className="px-3 py-2 font-medium">Roll no.</th>
                  <th className="w-20 px-3 py-2 font-medium">Pages</th>
                  <th className="w-32 px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {scripts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                      No scripts yet. Upload at least one PDF to continue.
                    </td>
                  </tr>
                ) : (
                  scripts.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <td className="max-w-[200px] truncate px-3 py-2 font-mono text-xs">
                        {r.fileName}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="h-8"
                          value={r.studentName}
                          onChange={(e) => updateRow(r.id, { studentName: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="h-8 w-28"
                          value={r.rollNo}
                          onChange={(e) => updateRow(r.id, { rollNo: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2 tabular-nums">{r.pages}</td>
                      <td className="px-3 py-2">
                        {r.status === "parsing" && (
                          <Badge variant="secondary" className="bg-slate-200 text-slate-800">
                            Parsing…
                          </Badge>
                        )}
                        {r.status === "ready" && (
                          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                            Ready
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button
              type="button"
              className="bg-[#01696f] text-white hover:bg-[#015a5f]"
              disabled={!canStart}
              onClick={onStartEvaluation}
            >
              Start evaluation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
