import { Film, History, Home, Inbox, LogOut, Menu, Search, User, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navLinks = [
  { path: "/", label: "Watchlist", icon: Home },
  { path: "/history", label: "History", icon: History },
  { path: "/browse", label: "Browse", icon: Search },
  { path: "/profile", label: "Profile", icon: User },
  // { path: "/inbox", label: "Inbox", icon: Inbox },
];

export default function Sidebar() {
  const { user, signOutUser } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const getInitial = () => {
    if (user?.displayName) return user.displayName[0].toUpperCase();
    if (user?.email) return user.email[0].toUpperCase();
    return "?";
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="mobile-toggle btn-icon"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            zIndex: 99, transition: "opacity 0.2s",
          }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Film size={22} color="#fff" />
          </div>
          <span className="sidebar-brand-text">My Watchlist</span>
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              style={{ marginLeft: "auto", color: "var(--text-muted)" }}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-section-title">Menu</span>
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`sidebar-link ${location.pathname === link.path ? "active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <link.icon size={20} />
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" />
              ) : (
                getInitial()
              )}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.displayName || "User"}</div>
              <div className="sidebar-user-email">{user?.email}</div>
            </div>
          </div>
          <button
            className="sidebar-link"
            onClick={signOutUser}
            style={{ width: "100%", marginTop: 8, color: "var(--danger)" }}
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
