"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StudentEnrollment } from "@/lib/types";
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
  Users,
  Loader2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { coerceCredits, formatCreditsDisplay, parseCreditsField } from "@/lib/credits-parse";
import { EnrollmentTableSkeleton } from "@/components/ui/loading-skeletons";

interface ParsedRow {
  student_name: string;
  email: string;
  term: string;
  subject: string;
  credits: number;
}

const REQUIRED_HEADERS = ["name", "email", "term", "subject", "credits"];

function parseCSV(text: string): { rows: ParsedRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], errors: ["File is empty or has no data rows."] };

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));

  const missing = REQUIRED_HEADERS.filter((r) => !headers.includes(r));
  if (missing.length > 0) {
    return { rows: [], errors: [`Missing columns: ${missing.join(", ")}. Required: ${REQUIRED_HEADERS.join(", ")}`] };
  }

  const nameIdx = headers.indexOf("name");
  const emailIdx = headers.indexOf("email");
  const termIdx = headers.indexOf("term");
  const subjectIdx = headers.indexOf("subject");
  const creditsIdx = headers.indexOf("credits");

  const rows: ParsedRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));

    const name = cols[nameIdx]?.trim();
    const email = cols[emailIdx]?.trim().toLowerCase();
    const term = cols[termIdx]?.trim();
    const subject = cols[subjectIdx]?.trim();
    const credits = parseCreditsField(cols[creditsIdx]);

    if (!name || !email || !term || !subject) {
      errors.push(`Row ${i + 1}: missing required field(s).`);
      continue;
    }

    if (!email.includes("@")) {
      errors.push(`Row ${i + 1}: invalid email "${email}".`);
      continue;
    }

    rows.push({ student_name: name, email, term, subject, credits });
  }

  return { rows, errors };
}

export function CsvUpload() {
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchEnrollments = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("student_enrollments")
      .select("*")
      .order("email")
      .order("subject");
    if (data) {
      setEnrollments(
        data.map((row) => ({
          ...row,
          credits: coerceCredits(row.credits),
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

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
    const existingNames = new Set((existingGroups ?? []).map((g) => g.name));

    const newGroups = subjectNames.filter((s) => !existingNames.has(s));
    if (newGroups.length > 0) {
      const { error: groupErr } = await supabase
        .from("student_groups")
        .insert(newGroups.map((name) => ({ name })));
      if (groupErr) {
        toast.error("Failed to create student groups: " + groupErr.message);
        setUploading(false);
        return;
      }
    }

    const { error } = await supabase
      .from("student_enrollments")
      .upsert(preview, { onConflict: "email,subject,term" });

    if (error) {
      toast.error("Failed to upload: " + error.message);
      setUploading(false);
      return;
    }

    toast.success(`${preview.length} enrollment records uploaded!`);
    setPreview(null);
    setParseErrors([]);
    if (fileRef.current) fileRef.current.value = "";
    setUploading(false);
    fetchEnrollments();

    await autoAssignAll(preview);
  }

  async function autoAssignAll(rows: ParsedRow[]) {
    setAssigning(true);
    const supabase = createClient();
    const uniqueEmails = [...new Set(rows.map((r) => r.email))];

    let assigned = 0;
    for (const email of uniqueEmails) {
      const { error } = await supabase.rpc("assign_groups_from_enrollments", {
        p_email: email,
      });
      if (!error) assigned++;
    }

    if (assigned > 0) {
      toast.success(`Auto-assigned groups for ${assigned} student(s) who already signed up.`);
    }
    setAssigning(false);
  }

  async function handleAssignAll() {
    setAssigning(true);
    const supabase = createClient();
    const uniqueEmails = [...new Set(enrollments.map((e) => e.email))];

    let assigned = 0;
    for (const email of uniqueEmails) {
      const { error } = await supabase.rpc("assign_groups_from_enrollments", {
        p_email: email,
      });
      if (!error) assigned++;
    }

    toast.success(`Processed ${assigned} email(s). Students who have signed up are now assigned to their groups.`);
    setAssigning(false);
  }

  async function handleClearAll() {
    if (!window.confirm("Delete ALL enrollment records? This won't remove students from groups they're already in.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("student_enrollments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      toast.error("Failed to clear: " + error.message);
      return;
    }
    toast.success("All enrollment records cleared.");
    fetchEnrollments();
  }

  const uniqueStudents = new Set(enrollments.map((e) => e.email)).size;
  const uniqueSubjects = new Set(enrollments.map((e) => e.subject)).size;
  const uniqueTerms = new Set(enrollments.map((e) => e.term)).size;

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Student Roster
          </CardTitle>
          <CardDescription>
            Upload a CSV file with columns: <strong>name, email, term, subject, credits</strong> (credits may be
            decimals, e.g. 1.5).
            Students will be auto-assigned to groups (by subject) when they sign up.
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
              href="/sample-roster.csv"
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
                    <><Upload className="h-4 w-4 mr-1.5" /> Upload & Assign</>
                  )}
                </Button>
              </div>

              <div className="max-h-60 overflow-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">Email</th>
                      <th className="px-3 py-2 text-left font-medium">Term</th>
                      <th className="px-3 py-2 text-left font-medium">Subject</th>
                      <th className="px-3 py-2 text-right font-medium">Credits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map((row, i) => (
                      <tr key={i} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-1.5">{row.student_name}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{row.email}</td>
                        <td className="px-3 py-1.5">{row.term}</td>
                        <td className="px-3 py-1.5">{row.subject}</td>
                        <td className="px-3 py-1.5 text-right">{formatCreditsDisplay(row.credits)}</td>
                      </tr>
                    ))}
                    {preview.length > 50 && (
                      <tr><td colSpan={5} className="px-3 py-2 text-center text-muted-foreground">...and {preview.length - 50} more rows</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current enrollments */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Current Enrollments
              </CardTitle>
              <CardDescription className="mt-1">
                {loading ? "Loading..." : `${enrollments.length} records — ${uniqueStudents} students, ${uniqueSubjects} subjects, ${uniqueTerms} term(s)`}
              </CardDescription>
            </div>
            {enrollments.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAssignAll}
                  disabled={assigning}
                  className="gap-1.5"
                >
                  {assigning ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Assigning...</>
                  ) : (
                    <><Users className="h-3.5 w-3.5" /> Re-assign All</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear All
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-4" aria-busy>
              <span className="sr-only">Loading enrollment data</span>
              <EnrollmentTableSkeleton />
            </div>
          ) : enrollments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileSpreadsheet className="h-10 w-10 mb-3" />
              <p>No enrollment records yet. Upload a CSV to get started.</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">Term</th>
                    <th className="px-3 py-2 text-left font-medium">Subject (Group)</th>
                    <th className="px-3 py-2 text-right font-medium">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e) => (
                    <tr key={e.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-1.5">{e.student_name}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{e.email}</td>
                      <td className="px-3 py-1.5">{e.term}</td>
                      <td className="px-3 py-1.5">
                        <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                          {e.subject}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right">{formatCreditsDisplay(e.credits)}</td>
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
