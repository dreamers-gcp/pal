"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProfessorAssignment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Loader2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { ProfessorAssignmentTableSkeleton } from "@/components/ui/loading-skeletons";
import { coerceCredits, formatCreditsDisplay, parseCreditsField } from "@/lib/credits-parse";

/** Parsed row — keys match `professor_assignments` */
interface ParsedRow {
  course_id: string;
  term: string;
  subject: string;
  professor: string;
  email: string;
  credits: number;
  preferred_slot_1: string | null;
  preferred_slot_2: string | null;
  preferred_slot_3: string | null;
  max_hours_per_day: number;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Handles commas inside quoted fields */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  result.push(cur.trim());
  return result;
}

function buildHeaderIndex(normHeaders: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  normHeaders.forEach((h, i) => {
    m[h] = i;
  });
  return m;
}

function col(idx: Record<string, number>, ...keys: string[]): number {
  for (const k of keys) {
    if (idx[k] !== undefined) return idx[k];
  }
  return -1;
}

function parseCSV(text: string): { rows: ParsedRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], errors: ["File is empty or has no data rows."] };

  const headers = splitCsvLine(lines[0]).map((h) => h.replace(/^["']|["']$/g, ""));
  const normHeaders = headers.map(normalizeHeader);
  const h = buildHeaderIndex(normHeaders);

  const ci = {
    course_id: col(h, "course_id", "courseid"),
    term: col(h, "term"),
    subject: col(h, "subject"),
    professor: col(h, "professor", "professor_name"),
    email: col(h, "email"),
    crpoints: col(h, "crpoints", "credits", "cr_points", "credit_points", "credit"),
    ps1: col(h, "preferred_slot_1", "preferred_slots_1", "preferred_slot_1"),
    ps2: col(h, "preferred_slot_2", "preferred_slots_2", "preferred_slot_2"),
    ps3: col(h, "preferred_slot_3", "preferred_slots_3", "preferred_slot_3"),
    maxh: col(h, "max_hours_per_day", "max_hours", "max_hours/day"),
  };

  const missing: string[] = [];
  if (ci.term < 0) missing.push("Term");
  if (ci.subject < 0) missing.push("Subject");
  if (ci.professor < 0) missing.push("Professor");
  if (ci.email < 0) missing.push("Email");
  if (ci.crpoints < 0) missing.push("CrPoints");
  if (ci.ps1 < 0) missing.push("Preferred Slot 1");
  if (ci.ps2 < 0) missing.push("Preferred Slot 2");
  if (ci.ps3 < 0) missing.push("Preferred Slot 3");
  if (ci.maxh < 0) missing.push("Max Hours/Day");

  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        `Missing column(s): ${missing.join(", ")}.`,
        "Required headers: Subject, Term, Professor, Email, CrPoints, Preferred Slot 1, Preferred Slot 2, Preferred Slot 3, Max Hours/Day. (Course ID is optional.)",
      ],
    };
  }

  const rows: ParsedRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]).map((c) => c.replace(/^["']|["']$/g, ""));

    const course_id = (cols[ci.course_id] ?? "").trim();
    const term = (cols[ci.term] ?? "").trim();
    const subject = (cols[ci.subject] ?? "").trim();
    const professor = (cols[ci.professor] ?? "").trim();
    const email = (cols[ci.email] ?? "").trim().toLowerCase();
    const credits = parseCreditsField(cols[ci.crpoints]);
    const preferred_slot_1 = (cols[ci.ps1] ?? "").trim() || null;
    const preferred_slot_2 = (cols[ci.ps2] ?? "").trim() || null;
    const preferred_slot_3 = (cols[ci.ps3] ?? "").trim() || null;
    const maxRaw = (cols[ci.maxh] ?? "").trim();
    const maxParsed = parseInt(maxRaw, 10);
    const max_hours_per_day =
      maxRaw !== "" && !isNaN(maxParsed) && maxParsed > 0 ? maxParsed : 4;

    if (!term || !subject || !professor || !email) {
      errors.push(`Row ${i + 1}: Term, Subject, Professor, and Email are required.`);
      continue;
    }

    if (!email.includes("@")) {
      errors.push(`Row ${i + 1}: invalid email "${email}".`);
      continue;
    }

    rows.push({
      course_id,
      term,
      subject,
      professor,
      email,
      credits: credits < 0 ? 0 : credits,
      preferred_slot_1,
      preferred_slot_2,
      preferred_slot_3,
      max_hours_per_day,
    });
  }

  return { rows, errors };
}

export function ProfessorCsvUpload() {
  const [assignments, setAssignments] = useState<ProfessorAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchAssignments = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("professor_assignments")
      .select("*")
      .order("email")
      .order("subject");
    if (data) {
      setAssignments(
        (data as ProfessorAssignment[]).map((row) => ({
          ...row,
          credits: coerceCredits(row.credits),
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows, errors } = parseCSV(text);
      setPreview(rows);
      setParseErrors(errors);
    };
    reader.readAsText(file);
  }

  async function handleUpload() {
    if (!preview || preview.length === 0) return;
    setUploading(true);

    const supabase = createClient();

    const subjectNames = [...new Set(preview.map((r) => r.subject))];
    const { data: existingGroups } = await supabase
      .from("student_groups")
      .select("name");
    const existingNames = new Set((existingGroups ?? []).map((g: { name: string }) => g.name));

    const newGroups = subjectNames.filter((s) => !existingNames.has(s));
    if (newGroups.length > 0) {
      const { error: groupErr } = await supabase
        .from("student_groups")
        .insert(newGroups.map((name) => ({ name })));
      if (groupErr) {
        toast.error("Failed to create programs: " + groupErr.message);
        setUploading(false);
        return;
      }
    }

    const { error } = await supabase
      .from("professor_assignments")
      .upsert(preview, { onConflict: "email,subject,term" });

    if (error) {
      toast.error("Failed to upload: " + error.message);
      setUploading(false);
      return;
    }

    toast.success(`${preview.length} professor assignment records uploaded!`);
    setPreview(null);
    setParseErrors([]);
    if (fileRef.current) fileRef.current.value = "";
    setUploading(false);
    fetchAssignments();
  }

  async function handleClearAll() {
    if (!window.confirm("Delete ALL professor assignment records?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("professor_assignments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      toast.error("Failed to clear: " + error.message);
      return;
    }
    toast.success("All professor assignment records cleared.");
    fetchAssignments();
  }

  const uniqueProfessors = new Set(assignments.map((e) => e.email)).size;
  const uniqueSubjects = new Set(assignments.map((e) => e.subject)).size;
  const uniqueTerms = new Set(assignments.map((e) => e.term)).size;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Professor Assignments
          </CardTitle>
          <CardDescription>
            Use this header row (order can vary):{" "}
            <strong>
              Subject, Term, Professor, Email, CrPoints, Preferred Slot 1, Preferred Slot 2,
              Preferred Slot 3, Max Hours/Day
            </strong>
            . CrPoints may be decimals (e.g. 1.5). Course ID column is optional. Empty preferred
            slots are ok.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/80 file:cursor-pointer"
            />
            <a
              href="/sample-professor-roster.csv"
              download
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input bg-transparent px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground no-underline text-foreground"
            >
              <Download className="h-3.5 w-3.5" />
              Sample CSV
            </a>
          </div>

          {parseErrors.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 space-y-1">
              <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                {parseErrors.length} parsing issue(s)
              </p>
              {parseErrors.slice(0, 5).map((err, i) => (
                <p key={i} className="text-xs text-destructive">{err}</p>
              ))}
              {parseErrors.length > 5 && (
                <p className="text-xs text-destructive font-medium">...and {parseErrors.length - 5} more</p>
              )}
            </div>
          )}

          {preview && preview.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-accent-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  {preview.length} valid row(s) ready to upload
                </p>
                <Button onClick={handleUpload} disabled={uploading} size="sm">
                  {uploading ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Uploading...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-1.5" /> Upload</>
                  )}
                </Button>
              </div>

              <div className="max-h-60 overflow-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Subject</th>
                      <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Term</th>
                      <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Professor</th>
                      <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Email</th>
                      <th className="px-2 py-2 text-right font-medium whitespace-nowrap">CrPoints</th>
                      <th className="px-2 py-2 text-left font-medium whitespace-nowrap max-w-[100px]">
                        Pref. 1
                      </th>
                      <th className="px-2 py-2 text-left font-medium whitespace-nowrap max-w-[100px]">
                        Pref. 2
                      </th>
                      <th className="px-2 py-2 text-left font-medium whitespace-nowrap max-w-[100px]">
                        Pref. 3
                      </th>
                      <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Max h/day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map((row, i) => (
                      <tr key={i} className="border-t hover:bg-muted/30">
                        <td className="px-2 py-1.5">{row.subject}</td>
                        <td className="px-2 py-1.5">{row.term}</td>
                        <td className="px-2 py-1.5">{row.professor}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{row.email}</td>
                        <td className="px-2 py-1.5 text-right">{formatCreditsDisplay(row.credits)}</td>
                        <td className="px-2 py-1.5 truncate max-w-[100px]" title={row.preferred_slot_1 ?? ""}>
                          {row.preferred_slot_1 ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 truncate max-w-[100px]" title={row.preferred_slot_2 ?? ""}>
                          {row.preferred_slot_2 ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 truncate max-w-[100px]" title={row.preferred_slot_3 ?? ""}>
                          {row.preferred_slot_3 ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right">{row.max_hours_per_day}</td>
                      </tr>
                    ))}
                    {preview.length > 50 && (
                      <tr><td colSpan={9} className="px-3 py-2 text-center text-muted-foreground">...and {preview.length - 50} more rows</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Current Professor Assignments
              </CardTitle>
              <CardDescription className="mt-1">
                {loading ? "Loading..." : `${assignments.length} records — ${uniqueProfessors} professors, ${uniqueSubjects} subjects, ${uniqueTerms} term(s)`}
              </CardDescription>
            </div>
            {assignments.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-4" aria-busy>
              <span className="sr-only">Loading professor assignments</span>
              <ProfessorAssignmentTableSkeleton />
            </div>
          ) : assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileSpreadsheet className="h-10 w-10 mb-3" />
              <p>No professor assignments yet. Upload a CSV to get started.</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Subject</th>
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Term</th>
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Professor</th>
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Email</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">CrPoints</th>
                    <th className="px-2 py-2 text-left font-medium max-w-[90px]">Pref. 1</th>
                    <th className="px-2 py-2 text-left font-medium max-w-[90px]">Pref. 2</th>
                    <th className="px-2 py-2 text-left font-medium max-w-[90px]">Pref. 3</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Max h/day</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id} className="border-t hover:bg-muted/30">
                      <td className="px-2 py-1.5">
                        <span className="inline-flex items-center rounded-md bg-purple-100 text-purple-700 px-2 py-0.5 text-xs font-medium">
                          {a.subject}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">{a.term}</td>
                      <td className="px-2 py-1.5">{a.professor}</td>
                      <td className="px-2 py-1.5 text-muted-foreground text-xs">{a.email}</td>
                      <td className="px-2 py-1.5 text-right">{formatCreditsDisplay(a.credits)}</td>
                      <td className="px-2 py-1.5 text-xs truncate max-w-[90px]" title={a.preferred_slot_1 ?? ""}>
                        {a.preferred_slot_1 ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-xs truncate max-w-[90px]" title={a.preferred_slot_2 ?? ""}>
                        {a.preferred_slot_2 ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-xs truncate max-w-[90px]" title={a.preferred_slot_3 ?? ""}>
                        {a.preferred_slot_3 ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right">{a.max_hours_per_day ?? 4}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
