import { NextResponse } from "next/server";
import { google } from "googleapis";

// Helper to clean and validate customer data
function cleanCustomerData(rows: (string | undefined)[][]) {
  return rows
    .map((row) => {
      const email = row[0]?.trim();
      const firstName = row[1]?.trim();
      const lastName = row[2]?.trim();

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (email && emailRegex.test(email)) {
        return { email, firstName, lastName };
      }
      return null;
    })
    .filter(
      (c): c is { email: string; firstName: string | undefined; lastName: string | undefined } =>
        c !== null
    );
}

export async function POST() {
  try {
    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(
      /\\n/g,
      "\n"
    );
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !sheetId) {
      return NextResponse.json(
        {
          error:
            "Google Sheets credentials are not configured in the environment.",
        },
        { status: 500 }
      );
    }

    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
    const shopifyAccessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shopDomain || !shopifyAccessToken) {
      return NextResponse.json(
        {
          error: "Shopify credentials are not configured in the environment.",
        },
        { status: 500 }
      );
    }

    // ── 1. Fetch from Google Sheets ──────────────────────────────────
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Fetch spreadsheet metadata to get the actual name of the first sheet
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const sheetName = meta.data.sheets?.[0]?.properties?.title || "Sheet1";

    // Columns A = Email, B = First Name, C = Last Name (header row skipped)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${sheetName}'!A2:C`,
    });

    const rows = response.data.values as (string | undefined)[][] | null | undefined;

    if (!rows || rows.length === 0) {
      return NextResponse.json({
        importedCount: 0,
        totalRows: 0,
        activationEmailsSent: 0,
        message: "No data found in Google Sheet.",
      });
    }

    const customersToImport = cleanCustomerData(rows);
    const totalRows = customersToImport.length;
    let importedCount = 0;
    let activationEmailsSent = 0;

    // ── 2. Import into Shopify ───────────────────────────────────────
    const shopifyGraphQLUrl = `https://${shopDomain}/admin/api/2024-01/graphql.json`;

    for (const customer of customersToImport) {
      // GraphQL mutation to create the customer with the required tag.
      const mutation = `
        mutation customerCreate($input: CustomerInput!) {
          customerCreate(input: $input) {
            customer {
              id
              email
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        input: {
          email: customer.email,
          firstName: customer.firstName ?? "",
          lastName: customer.lastName ?? "",
          // Tag used throughout the system — matches requirements.md
          tags: ["private_pricing_approved"],
        },
      };

      const shopifyRes = await fetch(shopifyGraphQLUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": shopifyAccessToken,
        },
        body: JSON.stringify({ query: mutation, variables }),
      });

      const shopifyData = await shopifyRes.json();

      if (shopifyData?.data?.customerCreate?.customer?.id) {
        importedCount++;
        const customerId = shopifyData.data.customerCreate.customer.id;

        // Send the Shopify account activation / invite email.
        const inviteMutation = `
          mutation customerSendAccountInvite($id: ID!) {
            customerSendAccountInvite(id: $id) {
              userErrors {
                field
                message
              }
            }
          }
        `;

        const inviteRes = await fetch(shopifyGraphQLUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": shopifyAccessToken,
          },
          body: JSON.stringify({
            query: inviteMutation,
            variables: { id: customerId },
          }),
        });

        const inviteData = await inviteRes.json();
        const inviteErrors =
          inviteData?.data?.customerSendAccountInvite?.userErrors ?? [];

        if (inviteErrors.length === 0) {
          activationEmailsSent++;
        } else {
          console.warn(
            `[/api/sync] Invite email errors for ${customer.email}:`,
            inviteErrors
          );
        }
      } else {
        // Handle duplicate email — customer already exists in Shopify.
        const errors = shopifyData?.data?.customerCreate?.userErrors ?? [];
        const isDuplicate = errors.some(
          (e: { field: string[]; message: string }) =>
            e.field.includes("email") &&
            e.message.includes("has already been taken")
        );

        if (isDuplicate) {
          console.log(
            `[/api/sync] Customer ${customer.email} already exists — skipping.`
          );
        } else {
          console.error(
            `[/api/sync] Failed to create customer: ${customer.email}`,
            errors
          );
        }
      }
    }

    return NextResponse.json({
      importedCount,
      totalRows,
      activationEmailsSent,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/sync] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
