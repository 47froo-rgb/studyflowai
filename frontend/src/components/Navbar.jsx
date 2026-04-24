import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { BookOpenText, ChartLineUp, ShieldStar, SignOut, Brain } from "@phosphor-icons/react";

const LinkItem = ({ to, label, icon: Icon, testid }) => (
  <NavLink
    to={to}
    data-testid={testid}
    className={({ isActive }) =>
      `flex items-center gap-2 px-3 py-2 font-heading font-bold rounded-md border-2 ${
        isActive ? "bg-lavender border-ink shadow-brut-sm" : "bg-transparent border-transparent hover:bg-paper hover:border-ink"
      }`
    }
  >
    <Icon size={18} weight="bold" />
    <span className="hidden sm:inline">{label}</span>
  </NavLink>
);

const Navbar = () => {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const handleLogout = async () => {
    await logout();
    nav("/login");
  };

  return (
    <header className="sticky top-0 z-40 bg-paper border-b-2 border-ink">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2" data-testid="brand-link">
          <span className="flex h-9 w-9 items-center justify-center bg-lavender border-2 border-ink rounded-md shadow-brut-sm">
            <Brain size={20} weight="duotone" />
          </span>
          <span className="font-heading text-xl font-black">StudyFlow <span className="text-lavender-700" style={{ color: "#7C6DFF" }}>AI</span></span>
        </Link>

        {user && user !== false && (
          <nav className="flex items-center gap-2" data-testid="main-nav">
            <LinkItem to="/dashboard" label="Library" icon={BookOpenText} testid="nav-library" />
            <LinkItem to="/progress" label="Progress" icon={ChartLineUp} testid="nav-progress" />
            {user.role === "admin" && (
              <LinkItem to="/admin" label="Admin" icon={ShieldStar} testid="nav-admin" />
            )}
            <button
              onClick={handleLogout}
              className="brut-btn-secondary ml-2 text-sm"
              data-testid="logout-button"
            >
              <SignOut size={16} weight="bold" /> <span className="hidden sm:inline">Logout</span>
            </button>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Navbar;
