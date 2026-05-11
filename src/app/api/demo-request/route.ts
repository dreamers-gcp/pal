import { NextRequest, NextResponse } from "next/server";

// ─── Google Sheets Setup (one-time) ────────────────────────────────────────
//
// 1. Open your spreadsheet:
//    https://docs.google.com/spreadsheets/d/1sGV9-SUF19dM24bh5u6TzbaCrf2Qu5OcsFqPfj6eWh4
//
// 2. Go to Extensions → Apps Script. Replace all code with:
//
//    function doPost(e) {
//      var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
//      if (sheet.getLastRow() === 0) {
//        sheet.appendRow(['Timestamp','Institution','Name','Role','Email','Phone','Challenge']);
//      }
//      var d = JSON.parse(e.postData.contents);
//      sheet.appendRow([
//        new Date().toISOString(),
//        d.institution || '', d.name || '', d.role || '',
//        d.email || '', d.phone || '', d.challenge || ''
//      ]);
//      return ContentService
//        .createTextOutput(JSON.stringify({ success: true }))
//        .setMimeType(ContentService.MimeType.JSON);
//    }
//
// 3. Click Deploy → New deployment → Web app
//    Execute as: Me   |   Who has access: Anyone
//    Click Deploy → copy the /exec URL
//
// 4. Add to .env.local:
//    SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_ID/exec
//
// ───────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const data = await req.json();
  const webhookUrl = process.env.SHEETS_WEBHOOK_URL;

  if (!webhookUrl) {
    // Fallback: log and return success so the form UX still works
    // while the sheet webhook is being configured.
    console.log("[demo-request] SHEETS_WEBHOOK_URL not set. Submission received:", data);
    return NextResponse.json({ success: true });
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      redirect: "follow",
    });

    if (!res.ok) {
      console.error("[demo-request] Webhook returned status", res.status);
      return NextResponse.json({ error: "upstream_error" }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[demo-request] Fetch failed:", err);
    return NextResponse.json({ error: "network_error" }, { status: 500 });
  }
}
