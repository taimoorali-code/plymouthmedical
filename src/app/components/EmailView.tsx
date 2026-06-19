"use client";
// EmailView — editable activation email template with live preview + recipients list.

import { useState } from "react";
import Card from "./Card";
import StatusBadge from "./StatusBadge";
import { Customer } from "./CustomersView";

export interface EmailTemplate {
  subject: string;
  body: string;
}

// The placeholder tokens that get auto-filled per customer.
const EMAIL_TOKENS = [
  "{{first_name}}",
  "{{email}}",
  "{{login_url}}",
];

// The store login URL — shown in the live preview.
const LOGIN_URL =
  process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL
    ? `https://${process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL}/account/login`
    : "https://yourstore.myshopify.com/account/login";

// Replace {{tokens}} with real values for the preview pane.
function fillTemplate(text: string, customer: Customer): string {
  const firstName = customer.name.split(" ")[0];
  return text
    .split("{{first_name}}").join(firstName)
    .split("{{email}}").join(customer.email)
    .split("{{login_url}}").join(LOGIN_URL);
}

interface EmailViewProps {
  email: EmailTemplate;
  saved: boolean;
  onChange: (next: EmailTemplate) => void;
  onSave: () => void;
  recipients: Customer[];
}

export default function EmailView({
  email,
  saved,
  onChange,
  onSave,
  recipients,
}: EmailViewProps) {
  // Use the first approved customer as the live-preview sample.
  const sample = recipients[0];

  // Per-recipient resend state
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<Record<string, "ok" | "err">>({});
  const [resendMsg, setResendMsg] = useState<Record<string, string>>({});

  // Bulk resend state
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleResend = async (customerEmail: string) => {
    setResendingEmail(customerEmail);
    setResendStatus((prev) => { const n = { ...prev }; delete n[customerEmail]; return n; });
    setResendMsg((prev) => { const n = { ...prev }; delete n[customerEmail]; return n; });
    try {
      const res = await fetch("/api/email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: customerEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResendStatus((prev) => ({ ...prev, [customerEmail]: "ok" }));
      setResendMsg((prev) => ({ ...prev, [customerEmail]: "Sent!" }));
    } catch (e: unknown) {
      setResendStatus((prev) => ({ ...prev, [customerEmail]: "err" }));
      setResendMsg((prev) => ({
        ...prev,
        [customerEmail]: e instanceof Error ? e.message : "Failed to send.",
      }));
    } finally {
      setResendingEmail(null);
    }
  };

  const handleBulkResend = async () => {
    if (!recipients.length) return;
    if (!confirm(`Resend activation emails to all ${recipients.length} approved customers?`)) return;
    setBulkSending(true);
    setBulkStatus(null);
    let sent = 0;
    let failed = 0;
    for (const customer of recipients) {
      try {
        const res = await fetch("/api/email/resend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: customer.email }),
        });
        if (res.ok) {
          sent++;
          setResendStatus((prev) => ({ ...prev, [customer.email]: "ok" }));
          setResendMsg((prev) => ({ ...prev, [customer.email]: "Sent!" }));
        } else {
          failed++;
          setResendStatus((prev) => ({ ...prev, [customer.email]: "err" }));
          setResendMsg((prev) => ({ ...prev, [customer.email]: "Failed" }));
        }
      } catch {
        failed++;
      }
    }
    setBulkStatus({
      type: failed === 0 ? "ok" : "err",
      text: `Sent: ${sent}, Failed: ${failed}`,
    });
    setBulkSending(false);
  };

  return (
    <>
      {/* ── Editable email copy ── */}
      <Card
        title="Account activation email template"
        subtitle="This is the email template reference. Shopify automatically sends an account activation email to each new customer when they are imported. The template below is for your reference — to customise Shopify's email, go to Shopify Admin → Settings → Notifications."
        action={
          <div className="btn-row">
            {saved ? (
              <span className="saved-tag" role="status">Saved</span>
            ) : (
              <span className="saved-tag saved-tag--unsaved" role="status">
                Unsaved changes
              </span>
            )}
            <button
              id="save-email-btn"
              className="btn btn--solid"
              onClick={onSave}
            >
              Save copy
            </button>
          </div>
        }
      >
        <label className="field" htmlFor="email-subject">
          <span className="field__label">Subject</span>
          <input
            id="email-subject"
            className="input"
            type="text"
            value={email.subject}
            onChange={(e) => onChange({ ...email, subject: e.target.value })}
          />
        </label>

        <label className="field" htmlFor="email-body">
          <span className="field__label">Message</span>
          <textarea
            id="email-body"
            className="input textarea"
            rows={12}
            value={email.body}
            onChange={(e) => onChange({ ...email, body: e.target.value })}
          />
        </label>

        {/* Token reference chips */}
        <div className="tokens">
          <span className="tokens__label">Available tokens:</span>
          {EMAIL_TOKENS.map((t) => (
            <code className="tag" key={t}>{t}</code>
          ))}
        </div>
      </Card>

      {/* ── Live preview ── */}
      {sample ? (
        <Card
          title="Preview"
          subtitle={`How the email looks for ${sample.name}.`}
        >
          <div className="email">
            <div className="email__meta">
              <span>
                <strong>To</strong> {sample.email}
              </span>
              <span>
                <strong>Subject</strong>{" "}
                {fillTemplate(email.subject, sample)}
              </span>
            </div>
            <pre className="email__body">
              {fillTemplate(email.body, sample)}
            </pre>
          </div>
        </Card>
      ) : (
        <Card title="Preview" subtitle="No approved customers yet to preview the email.">
          <p className="muted" style={{ fontSize: 13 }}>
            Import approved customers to see a live preview.
          </p>
        </Card>
      )}

      {/* ── Recipients list with Resend buttons ── */}
      <Card
        title="Recipients"
        subtitle="Approved customers who have been imported into Shopify. Use Resend to send a new activation email."
        action={
          recipients.length > 0 ? (
            <div className="btn-row">
              {bulkStatus && (
                <span
                  className={`saved-tag ${bulkStatus.type === "err" ? "saved-tag--unsaved" : ""}`}
                  role="status"
                >
                  {bulkStatus.text}
                </span>
              )}
              <button
                id="bulk-resend-btn"
                className="btn btn--ghost"
                onClick={handleBulkResend}
                disabled={bulkSending}
              >
                {bulkSending ? "Sending…" : `Resend All (${recipients.length})`}
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted" style={{ textAlign: "center", padding: "24px" }}>
                    No approved customers yet. Import from the Customers tab.
                  </td>
                </tr>
              ) : (
                recipients.map((c) => (
                  <tr key={c.email}>
                    <td>{c.name}</td>
                    <td className="muted">{c.email}</td>
                    <td>
                      {resendStatus[c.email] ? (
                        <StatusBadge status={resendStatus[c.email] === "ok" ? "Sent" : "Pending"} />
                      ) : (
                        <StatusBadge status="Sent" />
                      )}
                      {resendMsg[c.email] && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 12,
                            color: resendStatus[c.email] === "err" ? "var(--bad-ink)" : "var(--ok-ink)",
                          }}
                        >
                          {resendMsg[c.email]}
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn--ghost"
                        style={{ fontSize: 12, padding: "5px 10px" }}
                        disabled={resendingEmail === c.email}
                        onClick={() => handleResend(c.email)}
                      >
                        {resendingEmail === c.email ? "Sending…" : "Resend Invite"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
