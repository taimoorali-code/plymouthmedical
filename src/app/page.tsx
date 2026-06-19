"use client";

/**
 * page.tsx — Private Pricing Admin Dashboard
 *
 * Orchestrates sidebar state, customer data, email template state
 * and renders the correct view (Dashboard / Customers / Products / Email Setup).
 */

import { useState, useEffect, useCallback } from "react";
import Sidebar, { NavId } from "./components/Sidebar";
import Topbar from "./components/Topbar";
import DashboardView from "./components/DashboardView";
import CustomersView, { Customer } from "./components/CustomersView";
import ProductsView from "./components/ProductsView";
import EmailView, { EmailTemplate } from "./components/EmailView";

// ── Default email template ────────────────────────────────────────────
const DEFAULT_EMAIL: EmailTemplate = {
  subject: "Your account is ready — sign in to get started",
  body: `Hi {{first_name}},

Your account has been created on our store. Use the link below to activate your account and set your password:

Activate here: {{login_url}}

Once logged in, you will be able to view the exclusive product pricing we have set up for you.

If you have any questions, please reply to this email.

Thanks,
The team`,
};

// ── Helper: build stat cards from customer list ───────────────────────
function buildStats(
  customers: Customer[],
  activationEmailsSent: number,
  lastImport: string
) {
  const approved = customers.filter((c) => c.approved).length;
  const total = customers.length;

  return [
    {
      label: "Approved Customers",
      value: String(approved),
      hint: "Tagged in Shopify",
    },
    {
      label: "Total Customers",
      value: String(total),
      hint: "Rows in the sheet",
    },
    {
      label: "Activation Emails",
      value: String(activationEmailsSent),
      hint: "Sent to customers",
    },
    { label: "Last Import", value: lastImport, hint: "From Google Sheet" },
  ];
}

// ── Label map ─────────────────────────────────────────────────────────
const NAV_LABELS: Record<NavId, string> = {
  dashboard: "Dashboard",
  customers: "Customers",
  products: "Private Products",
  email: "Email Setup",
};

// ─────────────────────────────────────────────────────────────────────
// ROOT PAGE
// ─────────────────────────────────────────────────────────────────────

export default function Home() {
  // ── Navigation state ──────────────────────────────────────────────
  const [active, setActive] = useState<NavId>("dashboard");
  const [navOpen, setNavOpen] = useState(false);

  // ── Customer data ─────────────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);

  // ── Stats metadata ────────────────────────────────────────────────
  const [activationEmailsSent, setActivationEmailsSent] = useState(0);
  const [lastImport, setLastImport] = useState("—");

  // ── Email template state (lifted so edits survive tab switches) ───
  const [email, setEmail] = useState<EmailTemplate>(DEFAULT_EMAIL);
  const [emailSaved, setEmailSaved] = useState(true);

  // ── Fetch customer list on mount ──────────────────────────────────
  const fetchCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const res = await fetch("/api/customers");
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers ?? []);
      }
    } catch (err) {
      console.error("Failed to load customers:", err);
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // ── Email handlers ────────────────────────────────────────────────
  const handleEmailChange = (next: EmailTemplate) => {
    setEmail(next);
    setEmailSaved(false);
  };

  const handleEmailSave = async () => {
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(email),
      });
      if (res.ok) setEmailSaved(true);
    } catch (err) {
      console.error("Failed to save email template:", err);
    }
  };

  // ── Post-sync callback: refresh customers + update stats ──────────
  const handleSyncComplete = async (result: {
    importedCount: number;
    activationEmailsSent?: number;
  }) => {
    setActivationEmailsSent((prev) => prev + (result.activationEmailsSent ?? 0));
    setLastImport("just now");
    await fetchCustomers();
  };

  // ── Navigate helper (also closes mobile drawer) ───────────────────
  const navigate = (id: NavId) => {
    setActive(id);
    setNavOpen(false);
  };

  // ── Derived data ──────────────────────────────────────────────────
  const stats = buildStats(customers, activationEmailsSent, lastImport);
  const approvedCustomers = customers.filter((c) => c.approved);

  // ── Render correct view ───────────────────────────────────────────
  const renderView = () => {
    switch (active) {
      case "customers":
        return (
          <CustomersView
            customers={customers}
            loading={customersLoading}
            onSyncComplete={handleSyncComplete}
          />
        );
      case "products":
        return <ProductsView />;
      case "email":
        return (
          <EmailView
            email={email}
            saved={emailSaved}
            onChange={handleEmailChange}
            onSave={handleEmailSave}
            recipients={approvedCustomers}
          />
        );
      default:
        return <DashboardView onNavigate={navigate} stats={stats} />;
    }
  };

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <Sidebar active={active} onNavigate={navigate} open={navOpen} />

      {/* Mobile backdrop — closes drawer on tap outside */}
      {navOpen && (
        <div
          className="backdrop"
          onClick={() => setNavOpen(false)}
          role="presentation"
        />
      )}

      {/* ── Main column ── */}
      <div className="main">
        <Topbar onToggleNav={() => setNavOpen((o) => !o)} />

        <main className="content">
          {/* Back button — visible on any sub-section */}
          {active !== "dashboard" && (
            <button
              id="back-to-dashboard-btn"
              className="back-btn"
              onClick={() => setActive("dashboard")}
            >
              <span aria-hidden="true">←</span> Back to Dashboard
            </button>
          )}

          {/* Breadcrumb */}
          <p className="crumb">{NAV_LABELS[active]}</p>

          {/* Active view */}
          {renderView()}
        </main>
      </div>
    </div>
  );
}
