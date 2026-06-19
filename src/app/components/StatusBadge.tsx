// Coloured status pill used across the customer and email tables.
// status: "Approved" | "Pending" | "Sent"

interface StatusBadgeProps {
  status: "Approved" | "Pending" | "Sent";
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const map: Record<string, string> = {
    Approved: "badge--ok",
    Sent: "badge--ok",
    Pending: "badge--warn",
  };
  const cls = map[status] ?? "badge--muted";
  return <span className={`badge ${cls}`}>{status}</span>;
}
