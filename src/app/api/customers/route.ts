import { NextResponse } from "next/server";
import { google } from "googleapis";

/**
 * GET /api/customers
 *
 * Reads the same Google Sheet used by /api/sync and returns the
 * customer list so the dashboard table can display live data.
 * Each customer is marked `approved: true` if they have been
 * previously imported (i.e. they exist in the sheet — for MVP we
 * treat every valid row as an imported/approved customer once
 * this endpoint is called post-sync).
 */
export async function GET() {
  try {
    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(
      /\\n/g,
      "\n"
    );
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !sheetId) {
      return NextResponse.json(
        { error: "Google Sheets credentials are not configured." },
        { status: 500 }
      );
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Fetch spreadsheet metadata to get the actual name of the first sheet
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const sheetName = meta.data.sheets?.[0]?.properties?.title || "Sheet1";

    // Columns: A = Email, B = First Name, C = Last Name, D (optional) = Status
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${sheetName}'!A2:D`,
    });

    const rows = response.data.values ?? [];

    // Build a customer list. We treat every valid-email row as approved
    // (the sync step is what actually creates them in Shopify with the tag).
    const customers = rows
      .map((row) => {
        const email = row[0]?.trim();
        const firstName = row[1]?.trim() ?? "";
        const lastName = row[2]?.trim() ?? "";
        // Optional column D can hold a "status" override ("pending" etc.)
        const statusCol = row[3]?.trim().toLowerCase();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) return null;

        const name =
          firstName || lastName
            ? `${firstName} ${lastName}`.trim()
            : email.split("@")[0];

        // If there is an explicit "pending" marker in column D, mark as pending.
        const approved = statusCol !== "pending";

        return { name, email, approved };
      })
      .filter(Boolean);

    return NextResponse.json({ customers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/customers] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
