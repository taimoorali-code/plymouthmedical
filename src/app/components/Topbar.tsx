// Topbar — sticky header with hamburger, title and store badge.

interface TopbarProps {
  onToggleNav: () => void;
}

export default function Topbar({ onToggleNav }: TopbarProps) {
  return (
    <header className="topbar">
      <button
        id="hamburger-btn"
        className="hamburger"
        onClick={onToggleNav}
        aria-label="Toggle navigation"
      >
        <span />
        <span />
        <span />
      </button>

      <div className="topbar__text">
        <h1 className="topbar__title">Private Pricing Admin</h1>
        <p className="topbar__sub">
          Shopify customer login &amp; private product pricing setup
        </p>
      </div>

      <span className="store-badge">Development Store</span>
    </header>
  );
}
