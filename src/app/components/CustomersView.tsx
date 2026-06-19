// CustomersView — Google Sheet import table with real API sync.

import { useState } from "react";
import Card from "./Card";
import StatusBadge from "./StatusBadge";

export interface Customer {
  name: string;
  email: string;
  approved: boolean;
}

interface SyncResult {
  importedCount: number;
  totalRows?: number;
  activationEmailsSent?: number;
}

interface CustomersViewProps {
  customers: Customer[];
  loading: boolean;
  onSyncComplete: (result: SyncResult) => void;
}

export default function CustomersView({
  customers,
  loading,
  onSyncComplete,
}: CustomersViewProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [syncMessage, setSyncMessage] = useState("");

  const handleImport = async () => {
    setSyncing(true);
    setSyncStatus("idle");
    setSyncMessage("");

    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setSyncStatus("success");
        setSyncMessage(
          `Successfully imported ${data.importedCount} new customer${
            data.importedCount !== 1 ? "s" : ""
          } and tagged them private_pricing_approved.`
        );
        onSyncComplete(data as SyncResult);
      } else {
        setSyncStatus("error");
        setSyncMessage(data.error || "An error occurred during import.");
      }
    } catch (err: unknown) {
      setSyncStatus("error");
      setSyncMessage(
        err instanceof Error ? err.message : "Failed to connect to the server."
      );
    } finally {
      setSyncing(false);
    }
  };

  const reviewSheet = () => {
    // Open the Google Sheet — uses window.open so it works in Next.js
    const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL ?? "";
    if (sheetId) {
      window.open(sheetId, "_blank", "noopener,noreferrer");
    } else {
      alert(
        "Set NEXT_PUBLIC_GOOGLE_SHEET_URL in .env.local to link to your Google Sheet."
      );
    }
  };

  return (
    <Card
      title="Google Sheet import"
      subtitle="Imported customers are tagged private_pricing_approved automatically. Everyone else stays pending."
      action={
        <div className="btn-row">
          <button
            id="review-sheet-btn"
            className="btn btn--ghost"
            onClick={reviewSheet}
          >
            Review Sheet
          </button>
          <button
            id="import-customers-btn"
            className="btn btn--solid"
            onClick={handleImport}
            disabled={syncing}
          >
            {syncing ? "Importing…" : "Import Customers"}
          </button>
        </div>
      }
    >
      {/* Inline sync feedback */}
      {syncStatus !== "idle" && (
        <div
          className={`sync-banner ${
            syncStatus === "success" ? "sync-banner--success" : "sync-banner--error"
          }`}
          role="status"
        >
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Customer table */}
      <div className="table-wrap" style={{ marginTop: syncStatus !== "idle" ? 16 : 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Shopify Tag</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="muted" style={{ textAlign: "center", padding: "24px" }}>
                  Loading customers…
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted" style={{ textAlign: "center", padding: "24px" }}>
                  No customers found. Import from Google Sheet to get started.
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.email}>
                  <td>{c.name}</td>
                  <td className="muted">{c.email}</td>
                  <td>
                    <StatusBadge status={c.approved ? "Approved" : "Pending"} />
                  </td>
                  <td>
                    {c.approved ? (
                      <code className="tag">private_pricing_approved</code>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
