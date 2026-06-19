// DashboardView — overview stat cards + quick-access shortcuts.

import { NavId } from "./Sidebar";

interface Stat {
  label: string;
  value: string;
  hint: string;
}

interface DashboardViewProps {
  onNavigate: (id: NavId) => void;
  stats: Stat[];
}

const SHORTCUTS: { id: NavId; title: string; desc: string }[] = [
  {
    id: "customers",
    title: "Customers",
    desc: "Import customers from the Google Sheet and manage approved tags.",
  },
  {
    id: "products",
    title: "Private Products",
    desc: "Configure up to 4 products with exclusive fixed rates for approved customers.",
  },
  {
    id: "email",
    title: "Email Setup",
    desc: "Review the activation email template and resend invites to customers.",
  },
];

export default function DashboardView({
  onNavigate,
  stats,
}: DashboardViewProps) {
  return (
    <>
      {/* Stat cards */}
      <div className="stat-grid">
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <span className="stat__label">{s.label}</span>
            <span className="stat__value">{s.value}</span>
            <span className="stat__hint">{s.hint}</span>
          </div>
        ))}
      </div>

      {/* Quick access */}
      <h2 className="section-heading">Quick access</h2>
      <div className="shortcut-grid">
        {SHORTCUTS.map((s) => (
          <button
            key={s.id}
            id={`shortcut-${s.id}`}
            className="shortcut"
            onClick={() => onNavigate(s.id)}
          >
            <div className="shortcut__text">
              <span className="shortcut__title">{s.title}</span>
              <span className="shortcut__desc">{s.desc}</span>
            </div>
            <span className="shortcut__arrow" aria-hidden="true">
              →
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
