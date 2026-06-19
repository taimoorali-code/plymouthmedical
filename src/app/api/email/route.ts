import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/email
 *
 * Saves the email template. In this MVP the template is stored in
 * memory (resets on server restart). In production this should be
 * persisted to a database or a KV store.
 *
 * Request body: { subject: string; body: string }
 * Response:     { ok: true }
 */

// In-memory store — replace with a DB in production.
let savedTemplate: { subject: string; body: string } | null = null;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subject, body: emailBody } = body;

    if (typeof subject !== "string" || typeof emailBody !== "string") {
      return NextResponse.json(
        { error: "Invalid payload. Expected { subject, body }." },
        { status: 400 }
      );
    }

    savedTemplate = { subject: subject.trim(), body: emailBody.trim() };

    console.log("[/api/email] Template saved:", savedTemplate.subject);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/email] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/email
 *
 * Returns the currently saved template (or null if never saved).
 */
export async function GET() {
  return NextResponse.json({ template: savedTemplate });
}
