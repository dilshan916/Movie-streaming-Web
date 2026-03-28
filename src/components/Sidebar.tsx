import { Bookmark, Clock, Compass, Home, LogOut, User } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navLinks = [
  { path: "/", label: "Home", icon: Home },
  { path: "/browse", label: "Browse", icon: Compass },
  { path: "/watchlist", label: "Watchlist", icon: Bookmark },
  { path: "/history", label: "History", icon: Clock },
  { path: "/profile", label: "Profile", icon: User },
];

export default function Sidebar() {
  const { user, signOutUser } = useAuth();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);

  const getInitial = () => {
    if (user?.displayName) return user.displayName[0].toUpperCase();
    if (user?.email) return user.email[0].toUpperCase();
    return "?";
  };

  return (
    <>
      {/* Slim sidebar */}
      <aside
        className={`netflix-sidebar ${expanded ? "expanded" : ""}`}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        {/* Logo */}
        <div className="ns-logo">
          <div className="ns-logo-icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
              <path d="M4 4l4.5 16L12 8l3.5 12L20 4" stroke="#E50914" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {expanded && <span className="ns-logo-text">MY WATCHLIST</span>}
        </div>

        {/* Nav links */}
        <nav className="ns-nav">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path ||
              (link.path === "/" && location.pathname === "/") ||
              (link.path === "/browse" && location.pathname.startsWith("/movie/"));
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`ns-link ${isActive ? "active" : ""}`}
                title={link.label}
              >
                <link.icon size={22} />
                {expanded && <span className="ns-link-label">{link.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="ns-bottom">
          <button
            className={`ns-link`}
            onClick={signOutUser}
            title="Sign Out"
          >
            <LogOut size={22} />
            {expanded && <span className="ns-link-label">Sign Out</span>}
          </button>

          <div className="ns-avatar" title={user?.displayName || user?.email || "User"}>
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" />
            ) : (
              <span>{getInitial()}</span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
