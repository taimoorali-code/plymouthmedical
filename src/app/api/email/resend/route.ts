/**
 * POST /api/email/resend
 *
 * Resends the Shopify account activation (invite) email to a customer.
 *
 * Body: { email: string }
 *
 * Flow:
 *  1. Find the customer in Shopify by email.
 *  2. Call customerSendAccountInvite on their ID.
 */

import { NextRequest, NextResponse } from "next/server";
import { shopifyGraphQL } from "@/lib/shopify";

// Find a customer by email
const FIND_CUSTOMER_QUERY = `
  query findCustomer($query: String!) {
    customers(first: 1, query: $query) {
      edges {
        node {
          id
          email
          firstName
          state
        }
      }
    }
  }
`;

// Send the account invite / activation email
const SEND_INVITE_MUTATION = `
  mutation customerSendAccountInvite($id: ID!) {
    customerSendAccountInvite(id: $id) {
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

interface FindCustomerResponse {
  data: {
    customers: {
      edges: {
        node: {
          id: string;
          email: string;
          firstName: string;
          state: string;
        };
      }[];
    };
  };
}

interface InviteResponse {
  data: {
    customerSendAccountInvite: {
      customer: { id: string; email: string } | null;
      userErrors: { field: string[]; message: string }[];
    };
  };
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "email is required." }, { status: 400 });
    }

    // 1. Find the customer
    const findRes = await shopifyGraphQL<FindCustomerResponse>(
      FIND_CUSTOMER_QUERY,
      { query: `email:${email}` }
    );

    const customerEdge = findRes.data.customers.edges[0];
    if (!customerEdge) {
      return NextResponse.json(
        { error: `No Shopify customer found with email: ${email}` },
        { status: 404 }
      );
    }

    const customerId = customerEdge.node.id;

    // 2. Send the activation invite
    const inviteRes = await shopifyGraphQL<InviteResponse>(
      SEND_INVITE_MUTATION,
      { id: customerId }
    );

    const { userErrors } = inviteRes.data.customerSendAccountInvite;

    if (userErrors.length > 0) {
      return NextResponse.json(
        { error: userErrors.map((e) => e.message).join("; ") },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, email });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/email/resend] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
