// Sidebar — sticky left navigation panel.

type NavId = "dashboard" | "customers" | "products" | "email";

const NAV_ITEMS: { id: NavId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "customers", label: "Customers" },
  { id: "products", label: "Private Products" },
  { id: "email", label: "Email Setup" },
];

interface SidebarProps {
  active: NavId;
  onNavigate: (id: NavId) => void;
  open: boolean;
}

export default function Sidebar({ active, onNavigate, open }: SidebarProps) {
  return (
    <aside className={open ? "sidebar sidebar--open" : "sidebar"}>
      {/* Brand */}
      <div className="brand">
        <span className="brand__mark">PP</span>
        <span className="brand__name">Private Pricing</span>
      </div>

      {/* Navigation */}
      <nav className="nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            className={
              active === item.id ? "nav__item nav__item--active" : "nav__item"
            }
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar__foot">Shopify · Dev environment</div>
    </aside>
  );
}

export type { NavId };
