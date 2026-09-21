// Shared UI components for Campus Trace

import React from "react";
import { Link, useNavigate, useLocation, Navigate } from "react-router-dom";
import {
  Activity, AlertTriangle, Bell, BookOpen, ClipboardPlus,
  Globe, Home, LayoutDashboard, LogOut, Map, Settings,
  ShieldCheck, Users, BarChart3, FileText, Cpu,
} from "lucide-react";
import { useAuth } from "./auth";
import type { Role } from "./types";

export const DISCLAIMER =
  "Computational exposure-risk estimates are not medical diagnoses or confirmed infection probabilities.";

// ── Risk badge ──────────────────────────────────────────────────────────────

interface RiskBadgeProps {
  category: string;
  score?: number | null;
  size?: "sm" | "md" | "lg";
}

export function RiskBadge({ category, score, size = "md" }: RiskBadgeProps) {
  const cls = category.toLowerCase();
  const labels: Record<string, string> = {
    high: "HIGH",
    elevated: "ELEVATED",
    moderate: "MODERATE",
    low: "LOW",
    index: "INDEX CASE",
    none: "NO SIGNAL",
  };
  const text = labels[cls] ?? category;
  return (
    <span className={`pill ${cls}`}>
      {text}{score != null ? ` · ${Math.round(score)}/100` : ""}
    </span>
  );
}

// ── State components ─────────────────────────────────────────────────────────

export function LoadingState({ text = "Loading…" }: { text?: string }) {
  return <div className="state loading" role="status" aria-live="polite">{text}</div>;
}

export function ErrorState({ text }: { text: string }) {
  return <div className="state error" role="alert">{text}</div>;
}

export function EmptyState({ text }: { text: string }) {
  return <div className="state empty">{text}</div>;
}

// ── Page header ─────────────────────────────────────────────────────────────

interface HeaderProps {
  eyebrow: string;
  title: string;
  detail?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, detail, actions }: HeaderProps) {
  return (
    <header className="page-title">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {detail && <p>{detail}</p>}
        </div>
        {actions && <div className="actions" style={{ marginTop: 0 }}>{actions}</div>}
      </div>
    </header>
  );
}

// ── Safety footer ────────────────────────────────────────────────────────────

export function SafetyFooter() {
  return (
    <footer className="safety-footer">
      <ShieldCheck size={18} aria-hidden />
      <span>
        {DISCLAIMER} Real-world use requires public-health validation, privacy review,
        and institutional approval. This platform is a prototype decision-support system.
      </span>
    </footer>
  );
}

// ── Demo strip ───────────────────────────────────────────────────────────────

export function DemoStrip({ label = "DEMO / SYNTHETIC DATA" }: { label?: string }) {
  return (
    <div className="demo-strip" role="note" aria-label="This is synthetic data">
      <AlertTriangle size={14} aria-hidden />
      {label} – All records are synthetic and not representative of real individuals.
    </div>
  );
}

// ── Protected route ──────────────────────────────────────────────────────────

export function Protected({ role, children }: { role: Role; children: React.ReactNode }) {
  const { session } = useAuth();
  const home =
    session?.role === "ADMIN"
      ? "/admin/dashboard"
      : session?.role === "TEACHER"
        ? "/teacher/dashboard"
        : "/student/dashboard";

  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== role) return <Navigate to={home} replace />;
  return <>{children}</>;
}

// ── App shell / sidebar ──────────────────────────────────────────────────────

const studentNav = [
  { to: "/student/dashboard", label: "Dashboard", icon: <Home size={17} /> },
  { to: "/student/report-case", label: "Report a case", icon: <ClipboardPlus size={17} /> },
  { to: "/student/notifications", label: "Notifications", icon: <Bell size={17} /> },
];

const teacherNav = [
  { to: "/teacher/dashboard", label: "Dashboard", icon: <LayoutDashboard size={17} /> },
  { to: "/teacher/classes", label: "My classes", icon: <BookOpen size={17} /> },
];

const adminNav = [
  { to: "/admin/dashboard", label: "Dashboard", icon: <LayoutDashboard size={17} /> },
  { to: "/admin/investigations", label: "Investigations", icon: <Users size={17} /> },
  { to: "/admin/graph", label: "Contact graph", icon: <Globe size={17} /> },
  { to: "/admin/map", label: "Campus map", icon: <Map size={17} /> },
  { to: "/admin/analytics", label: "Analytics", icon: <BarChart3 size={17} /> },
  { to: "/admin/students", label: "Students", icon: <Users size={17} /> },
  { to: "/admin/simulation", label: "Demo simulation", icon: <Cpu size={17} /> },
  { to: "/admin/audit", label: "Audit trail", icon: <FileText size={17} /> },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { session, setSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const logout = () => {
    setSession(null);
    localStorage.removeItem("campus-trace-session");
    navigate("/login");
  };

  const home =
    session?.role === "ADMIN"
      ? "/admin/dashboard"
      : session?.role === "TEACHER"
        ? "/teacher/dashboard"
        : "/student/dashboard";

  const navLinks =
    session?.role === "ADMIN"
      ? adminNav
      : session?.role === "TEACHER"
        ? teacherNav
        : studentNav;

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <Link className="brand" to={home}>
          <span className="brand-mark"><Activity size={20} aria-hidden /></span>
          <span>
            Campus Trace<small>Early-warning prototype</small>
          </span>
        </Link>

        <div className="data-badge" role="note">DEMO / SYNTHETIC DATA</div>

        {session && (
          <nav>
            {navLinks.map(({ to, label, icon }) => (
              <Link
                key={to}
                to={to}
                className={location.pathname === to ? "active" : ""}
                aria-current={location.pathname === to ? "page" : undefined}
              >
                {icon}
                {label}
              </Link>
            ))}
          </nav>
        )}

        {session && (
          <button className="sign-out" onClick={logout} aria-label="Sign out">
            <LogOut size={17} aria-hidden />
            Sign out
          </button>
        )}
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
