import { StrictMode, useState, useEffect, FormEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  Link,
  useNavigate,
} from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  ClipboardPlus,
  Cpu,
  FileText,
  Globe,
  Home,
  LayoutDashboard,
  LogOut,
  Map,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./styles.css";

// ─── Types ───────────────────────────────────────────────────────────────────

type Role = "STUDENT" | "TEACHER" | "ADMIN";
type Session = { token: string; access_token?: string; role: Role };
type Notif = {
  id: number;
  title: string;
  message: string;
  risk_score: number;
  category: string;
  is_acknowledged: boolean;
  created_at: string;
};
type GraphNodeData = {
  id: string;
  label: string;
  role: string;
  risk_score: number | null;
  category?: string;
  confidence?: number;
  graph_distance?: number;
};
type GraphEdgeData = { source: string; target: string; graph_distance?: number };
type GraphData = {
  investigation_id: number;
  status: string;
  max_depth?: number;
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  disclaimer: string;
};
type Location = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  environment_type: string;
  contact_events: number;
};

// ─── API ─────────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

async function api<T>(
  path: string,
  token?: string,
  options?: RequestInit
): Promise<T> {
  let authToken = token;
  if (!authToken) {
    try {
      const raw = localStorage.getItem("campus-trace-session");
      if (raw) {
        const parsed = JSON.parse(raw);
        authToken = parsed.token || parsed.access_token;
      }
    } catch {
      // ignore
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(body?.detail ?? "The request could not be completed.");
  }
  return res.json() as Promise<T>;
}

// ─── Auth state ───────────────────────────────────────────────────────────────

import { createContext, useContext } from "react";

const Auth = createContext<{
  session: Session | null;
  setSession: (v: Session | null) => void;
}>({ session: null, setSession: () => undefined });

const useAuth = () => useContext(Auth);

const DISCLAIMER =
  "Computational exposure-risk estimates are not medical diagnoses or confirmed infection probabilities.";

// ─── Shared components ────────────────────────────────────────────────────────

function RiskBadge({
  category,
  score,
}: {
  category: string;
  score?: number | null;
}) {
  const cls = category.toLowerCase();
  const labels: Record<string, string> = {
    high: "HIGH",
    elevated: "ELEVATED",
    moderate: "MODERATE",
    low: "LOW",
    index: "INDEX CASE",
    none: "NO SIGNAL",
  };
  return (
    <span className={`pill ${cls}`}>
      {labels[cls] ?? category}
      {score != null ? ` · ${Math.round(score)}/100` : ""}
    </span>
  );
}

function State({
  kind,
  text,
}: {
  kind: "loading" | "error" | "empty";
  text: string;
}) {
  return (
    <div
      className={`state ${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {text}
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  detail,
  actions,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-title">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
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

function SafetyFooter() {
  return (
    <footer className="safety-footer">
      <ShieldCheck size={18} aria-hidden />
      <span>
        {DISCLAIMER} Real-world use requires public-health validation, privacy
        review, and institutional approval.
      </span>
    </footer>
  );
}

function DemoStrip() {
  return (
    <div className="demo-strip" role="note">
      <AlertTriangle size={14} aria-hidden />
      DEMO / SYNTHETIC DATA – All records are synthetic and not representative of
      real individuals.
    </div>
  );
}

function Protected({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const { session } = useAuth();
  if (!session || !session.token) return <Navigate to="/login" replace />;
  const home =
    session.role === "ADMIN"
      ? "/admin/dashboard"
      : session.role === "TEACHER"
      ? "/teacher/dashboard"
      : "/student/dashboard";
  if (session.role !== role) return <Navigate to={home} replace />;
  return <>{children}</>;
}

// ─── Notification card ────────────────────────────────────────────────────────

function NotifCard({
  notif,
  refresh,
}: {
  notif: Notif;
  refresh?: () => void;
}) {
  const { session } = useAuth();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const respond = async (response: "YES" | "NO" | "NOT_SURE") => {
    setBusy(true);
    try {
      await api(`/notifications/${notif.id}/symptom-response`, session!.token, {
        method: "POST",
        body: JSON.stringify({ response }),
      });
      setStatus(
        "Response recorded. It does not determine infection status."
      );
      refresh?.();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Unable to record.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="notification">
      <div>
        <RiskBadge category={notif.category} score={notif.risk_score} />
        <h3>{notif.title}</h3>
        <p>{notif.message}</p>
      </div>
      <div className="symptom-actions">
        <span>Are you experiencing listed symptoms?</span>
        <div>
          <button disabled={busy} onClick={() => respond("YES")}>Yes</button>
          <button disabled={busy} onClick={() => respond("NO")}>No</button>
          <button disabled={busy} onClick={() => respond("NOT_SURE")}>Not sure</button>
        </div>
        {status && <small role="status">{status}</small>}
      </div>
    </article>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

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

function Shell({ children }: { children: React.ReactNode }) {
  const { session, setSession } = useAuth();
  const navigate = useNavigate();
  const location = window.location;

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
          <span className="brand-mark">
            <Activity size={20} aria-hidden />
          </span>
          <span>
            Campus Trace<small>Early-warning prototype</small>
          </span>
        </Link>
        <div className="data-badge" role="note">
          DEMO / SYNTHETIC DATA
        </div>
        {session && (
          <nav>
            {navLinks.map(({ to, label, icon }) => (
              <Link
                key={to}
                to={to}
                className={location.pathname === to ? "active" : ""}
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
      <main className="main-content">{children}</main>
    </div>
  );
}

// ─── Login page ───────────────────────────────────────────────────────────────

function Login() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin.demo");
  const [password, setPassword] = useState("AdminDemo123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const doLogin = async (u: string, p: string) => {
    setLoading(true);
    setError("");
    try {
      const result = await api<{ access_token: string; token?: string; role: Role }>("/auth/login", undefined, {
        method: "POST",
        body: JSON.stringify({ username: u, password: p }),
      });
      const validToken = result.token || result.access_token;
      const sessionObj: Session = {
        token: validToken,
        access_token: validToken,
        role: result.role,
      };
      setSession(sessionObj);
      localStorage.setItem("campus-trace-session", JSON.stringify(sessionObj));
      navigate(
        result.role === "ADMIN"
          ? "/admin/dashboard"
          : result.role === "TEACHER"
          ? "/teacher/dashboard"
          : "/student/dashboard"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (role: Role) => {
    const map: Record<Role, [string, string]> = {
      ADMIN: ["admin.demo", "AdminDemo123!"],
      TEACHER: ["teacher.demo", "TeacherDemo123!"],
      STUDENT: ["student.demo", "StudentDemo123!"],
    };
    const [u, p] = map[role];
    setUsername(u);
    setPassword(p);
    doLogin(u, p);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await doLogin(username, password);
  };

  return (
    <Shell>
      <section className="login-layout">
        <div className="hero">
          <p className="eyebrow">CAMPUS EXPOSURE MONITORING</p>
          <h1>
            Better signals.
            <br />
            Careful decisions.
          </h1>
          <p>
            Campus Trace demonstrates privacy-aware contact-network workflows
            using entirely synthetic data.
          </p>
          <p className="medical-note">
            <ShieldCheck size={18} aria-hidden />
            {DISCLAIMER}
          </p>
        </div>
        <form className="card login-card" onSubmit={submit}>
          <p className="eyebrow">SECURE ACCESS</p>
          <h2>Sign in or select role</h2>

          <div className="demo-buttons" style={{ borderTop: "none", paddingTop: 0, marginBottom: "0.5rem" }}>
            <span style={{ display: "block", marginBottom: "0.5rem", fontWeight: 700 }}>
              ⚡ 1-Click Instant Demo Login:
            </span>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: "0.5rem 0.8rem", fontSize: "0.85rem", fontWeight: 700 }}
                disabled={loading}
                onClick={() => quickLogin("ADMIN")}
              >
                Admin (Full access)
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: "0.5rem 0.8rem", fontSize: "0.85rem" }}
                disabled={loading}
                onClick={() => quickLogin("STUDENT")}
              >
                Student
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: "0.5rem 0.8rem", fontSize: "0.85rem" }}
                disabled={loading}
                onClick={() => quickLogin("TEACHER")}
              >
                Teacher
              </button>
            </div>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid #e0ece8", margin: "0.5rem 0" }} />

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn-primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign in with credentials"}
          </button>
        </form>
      </section>
    </Shell>
  );
}

// ─── Student Dashboard ────────────────────────────────────────────────────────

function StudentDashboard() {
  const { session } = useAuth();
  const [notices, setNotices] = useState<Notif[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Notif[]>("/students/me/exposure", session!.token)
      .then(setNotices)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session]);

  const top = notices[0];

  return (
    <Shell>
      <PageHeader
        eyebrow="STUDENT PORTAL"
        title="Your exposure overview"
        detail="Your view is private and contains only your own information."
      />
      <DemoStrip />
      <div className="grid grid-2 student-grid">
        <section className={`card risk-card`}>
          <p className="eyebrow">CURRENT ESTIMATED EXPOSURE RISK</p>
          <strong className="risk">{top?.category ?? "NO CURRENT SIGNAL"}</strong>
          <p>
            {top
              ? `${top.risk_score} / 100 estimated exposure risk`
              : "No exposure notifications are available."}
          </p>
          <small>{DISCLAIMER}</small>
        </section>
        <section className="card">
          <h2>What you can do</h2>
          <ul className="checklist">
            <li>Review your exposure notification.</li>
            <li>Respond to the symptom follow-up.</li>
            <li>Report a case privately if appropriate.</li>
          </ul>
          <Link className="text-link" to="/student/report-case">
            Report a case →
          </Link>
        </section>
      </div>
      <section className="card section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">RECENT NOTIFICATIONS</p>
            <h2>Exposure follow-up</h2>
          </div>
          <Link className="text-link" to="/student/notifications">
            View all
          </Link>
        </div>
        {loading ? (
          <State kind="loading" text="Loading notifications…" />
        ) : error ? (
          <State kind="error" text={error} />
        ) : top ? (
          <NotifCard notif={top} />
        ) : (
          <State kind="empty" text="No notifications yet." />
        )}
      </section>
      <SafetyFooter />
    </Shell>
  );
}

// ─── Student Notifications ────────────────────────────────────────────────────

function Notifications() {
  const { session } = useAuth();
  const [notices, setNotices] = useState<Notif[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api<Notif[]>("/notifications", session!.token)
      .then(setNotices)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [session]);

  return (
    <Shell>
      <PageHeader
        eyebrow="STUDENT PORTAL"
        title="Notifications"
        detail={`Follow-up responses are private. A "No" does not establish medical status.`}
      />
      <DemoStrip />
      <section className="stack">
        {loading ? (
          <State kind="loading" text="Loading notifications…" />
        ) : error ? (
          <State kind="error" text={error} />
        ) : notices.length ? (
          notices.map((n) => <NotifCard key={n.id} notif={n} refresh={load} />)
        ) : (
          <State kind="empty" text="No notifications yet." />
        )}
      </section>
      <SafetyFooter />
    </Shell>
  );
}

// ─── Student Report Case ──────────────────────────────────────────────────────

function ReportCase() {
  const { session } = useAuth();
  const [diseases, setDiseases] = useState<{ id: number; name: string }[]>([]);
  const [diseaseId, setDiseaseId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<typeof diseases>("/diseases", session!.token)
      .then((items) => {
        setDiseases(items);
        setDiseaseId(String(items[0]?.id ?? ""));
      })
      .catch((e) => setStatus(e.message));
  }, [session]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/cases/report", session!.token, {
        method: "POST",
        body: JSON.stringify({
          disease_id: Number(diseaseId),
          date_reported: date,
          symptoms: symptoms
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          notes: notes || undefined,
        }),
      });
      setStatus(
        "Your private report was created. An authorised workflow can now review it."
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Unable to submit report.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <PageHeader
        eyebrow="PRIVATE REPORT"
        title="Report a case"
        detail="Your report is not visible to other students or teachers."
      />
      <DemoStrip />
      <form className="card" style={{ maxWidth: "42rem" }} onSubmit={submit}>
        <div
          style={{ display: "grid", gap: "1.1rem" }}
        >
          <div className="form-group">
            <label htmlFor="disease">Disease profile</label>
            <select
              id="disease"
              value={diseaseId}
              onChange={(e) => setDiseaseId(e.target.value)}
            >
              {diseases.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="date">Date reported</label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="symptoms">Symptoms (optional, comma-separated)</label>
            <input
              id="symptoms"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="e.g. fatigue, cough, fever"
            />
          </div>
          <div className="form-group">
            <label htmlFor="notes">Notes (optional)</label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context…"
              style={{ resize: "vertical" }}
            />
          </div>
          <button className="btn-primary" disabled={loading}>
            {loading ? "Submitting…" : "Submit private report"}
          </button>
          {status && (
            <p
              className={
                status.includes("created") ? "form-status" : "form-error"
              }
              role="status"
            >
              {status}
            </p>
          )}
        </div>
      </form>
      <SafetyFooter />
    </Shell>
  );
}

// ─── Teacher Dashboard ────────────────────────────────────────────────────────

function TeacherDashboard() {
  const { session } = useAuth();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Record<string, unknown>>("/teacher/dashboard", session!.token)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [session]);

  if (error) return <Shell><State kind="error" text={error} /></Shell>;
  if (!data) return <Shell><State kind="loading" text="Loading class data…" /></Shell>;

  const exposure = data.anonymized_exposure_status as Record<string, number>;
  const classes = data.assigned_classes as string[];
  const locations = data.affected_locations as string[];

  return (
    <Shell>
      <PageHeader
        eyebrow="TEACHER PORTAL"
        title="Class-level awareness"
        detail="This view intentionally shows aggregate information only to protect student privacy."
      />
      <DemoStrip />
      <div className="grid grid-3">
        <div className="metric">
          <p>Students under monitoring</p>
          <strong>{exposure.monitoring ?? 0}</strong>
          <small>Unacknowledged alerts</small>
        </div>
        <div className="metric">
          <p>Elevated risk signals</p>
          <strong className="trend-up">{exposure.elevated ?? 0}</strong>
          <small>Anonymised aggregate</small>
        </div>
        <div className="metric">
          <p>High risk signals</p>
          <strong className="trend-up">{exposure.high ?? 0}</strong>
          <small>Anonymised aggregate</small>
        </div>
      </div>
      <div className="grid grid-2 mt-3">
        <div className="card">
          <p className="eyebrow">ASSIGNED CLASSES</p>
          <h2>{classes.join(", ")}</h2>
          <p>Aggregate synthetic signals for your assigned courses.</p>
        </div>
        <div className="card">
          <p className="eyebrow">AFFECTED LOCATIONS</p>
          <h2>Campus areas</h2>
          <p>
            {locations?.length
              ? `Elevated contact density noted near: ${locations.join(", ")}.`
              : "No affected locations reported."}
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">RECOMMENDED ACTION</p>
          <h2>Protect privacy</h2>
          <p>{String(data.recommended_action)}</p>
        </div>
        <div className="card">
          <p className="eyebrow">DISCLAIMER</p>
          <h2>Aggregate only</h2>
          <p>{String(data.disclaimer)}</p>
        </div>
      </div>
      <SafetyFooter />
    </Shell>
  );
}

function TeacherClasses() {
  const { session } = useAuth();
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    api<Record<string, unknown>>("/teacher/dashboard", session!.token)
      .then(setData)
      .catch(() => {});
  }, [session]);

  const classes = (data?.assigned_classes as string[]) ?? [];

  return (
    <Shell>
      <PageHeader eyebrow="TEACHER PORTAL" title="My classes" />
      <DemoStrip />
      <div className="card">
        <p className="eyebrow">ENROLLED CLASSES</p>
        <div style={{ display: "grid", gap: ".75rem", marginTop: ".5rem" }}>
          {classes.map((cls) => (
            <div
              key={cls}
              style={{
                padding: ".75rem 1rem",
                background: "#f5faf8",
                borderRadius: ".55rem",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <strong>{cls}</strong>
              <span className="badge">ACTIVE</span>
            </div>
          ))}
        </div>
      </div>
      <SafetyFooter />
    </Shell>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

function AdminDashboard() {
  const { session } = useAuth();
  const [data, setData] = useState<Record<string, number | string> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Record<string, number | string>>("/admin/dashboard", session!.token)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [session]);

  const metrics = [
    ["Active cases", "active_cases"],
    ["Students under monitoring", "students_under_monitoring"],
    ["Elevated/high-risk contacts", "elevated_or_high_contacts"],
    ["Potential clusters", "potential_exposure_clusters"],
  ];

  return (
    <Shell>
      <PageHeader
        eyebrow="ADMINISTRATOR"
        title="Campus situation room"
        detail="Use insights as a prototype decision-support signal, not medical confirmation."
        actions={
          <Link to="/admin/simulation" className="btn-primary">
            <Cpu size={16} />
            Generate demo
          </Link>
        }
      />
      <DemoStrip />
      <div className="grid grid-4">
        {error ? (
          <State kind="error" text={error} />
        ) : !data ? (
          <State kind="loading" text="Loading dashboard…" />
        ) : (
          metrics.map(([label, key]) => (
            <div className="metric" key={key}>
              <p>{label}</p>
              <strong>{data[key]}</strong>
              <small>DEMO / SYNTHETIC</small>
            </div>
          ))
        )}
      </div>

      <div className="grid grid-2 mt-3">
        <div className="card">
          <p className="eyebrow">QUICK NAVIGATION</p>
          <h2>Investigation tools</h2>
          <div className="actions">
            <Link to="/admin/investigations" className="btn-secondary">
              <Users size={16} />
              Investigations
            </Link>
            <Link to="/admin/graph" className="btn-secondary">
              <Globe size={16} />
              Contact graph
            </Link>
            <Link to="/admin/map" className="btn-secondary">
              <Map size={16} />
              Campus map
            </Link>
            <Link to="/admin/analytics" className="btn-secondary">
              <BarChart3 size={16} />
              Analytics
            </Link>
          </div>
        </div>
        <div className="card">
          <p className="eyebrow">SYSTEM STATUS</p>
          <h2>Services</h2>
          <div style={{ display: "grid", gap: ".4rem", fontSize: ".87rem" }}>
            {[
              ["Backend API", "healthy"],
              ["Database", "SQLite (demo mode)"],
              ["Risk engine", "rule-based-demo-0.1"],
              ["Neo4j", "not configured (demo)"],
              ["ML model", "rule-based fallback"],
            ].map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#4a6960" }}>{label}</span>
                <span className="badge">{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <SafetyFooter />
    </Shell>
  );
}

// ─── Admin Investigations ─────────────────────────────────────────────────────

type Investigation = {
  id: number;
  case_id: number;
  status: string;
  max_depth: number;
  index_student: string;
  disease: string;
  contact_count: number;
  created_at: string | null;
};

function AdminInvestigations() {
  const { session } = useAuth();
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Investigation[]>("/investigations", session!.token)
      .then(setInvestigations)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session]);

  return (
    <Shell>
      <PageHeader
        eyebrow="ADMINISTRATOR"
        title="Investigations"
        detail="Bounded BFS exposure investigations over the synthetic contact graph."
        actions={
          <Link to="/admin/simulation" className="btn-primary">
            <Cpu size={16} />
            Run new demo
          </Link>
        }
      />
      <DemoStrip />
      <div className="card">
        {loading ? (
          <State kind="loading" text="Loading investigations…" />
        ) : error ? (
          <State kind="error" text={error} />
        ) : investigations.length === 0 ? (
          <State kind="empty" text="No investigations yet. Generate a simulation to get started." />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Index student</th>
                  <th>Disease</th>
                  <th>Contacts found</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {investigations.map((inv) => (
                  <tr key={inv.id}>
                    <td>#{inv.id}</td>
                    <td>
                      <code style={{ fontSize: ".8rem" }}>{inv.index_student}</code>
                    </td>
                    <td>{inv.disease}</td>
                    <td>{inv.contact_count}</td>
                    <td>
                      <span className="badge">{inv.status}</span>
                    </td>
                    <td style={{ fontSize: ".8rem", color: "#6d8880" }}>
                      {inv.created_at
                        ? new Date(inv.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      <Link
                        to={`/admin/investigations/${inv.id}`}
                        className="text-link"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <SafetyFooter />
    </Shell>
  );
}

// ─── Admin Investigation Detail ───────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  HIGH: "#c0392b",
  ELEVATED: "#e67e22",
  MODERATE: "#f39c12",
  LOW: "#27ae60",
  INDEX_CASE: "#2980b9",
};

function buildFlowGraph(graphData: GraphData): {
  nodes: Node[];
  edges: Edge[];
} {
  const indexNode = graphData.nodes.find((n) => n.role === "INDEX_CASE");
  const contactNodes = graphData.nodes.filter((n) => n.role !== "INDEX_CASE");

  const radius = Math.min(220, 60 + contactNodes.length * 12);
  const flowNodes: Node[] = [];
  const flowEdges: Edge[] = [];

  if (indexNode) {
    flowNodes.push({
      id: indexNode.id,
      position: { x: 0, y: 0 },
      data: { ...indexNode },
      style: {
        background: RISK_COLORS.INDEX_CASE,
        color: "#fff",
        border: "2px solid #1a5276",
        borderRadius: "50%",
        width: 70,
        height: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "10px",
        fontWeight: "bold",
      },
    });
  }

  contactNodes.forEach((node, i) => {
    const angle = (i / contactNodes.length) * 2 * Math.PI - Math.PI / 2;
    const dist = node.graph_distance === 1 ? radius : radius * 1.8;
    const x = dist * Math.cos(angle);
    const y = dist * Math.sin(angle);
    const color = RISK_COLORS[node.category ?? "LOW"] ?? "#95a5a6";

    flowNodes.push({
      id: node.id,
      position: { x, y },
      data: { ...node },
      style: {
        background: color + "22",
        border: `2px solid ${color}`,
        borderRadius: ".6rem",
        color: "#152c28",
        fontSize: "10px",
        fontWeight: "600",
        width: 60,
        height: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    });
  });

  graphData.edges.forEach((edge, i) => {
    const targetNode = graphData.nodes.find((n) => n.id === edge.target);
    const color =
      RISK_COLORS[targetNode?.category ?? "LOW"] ?? "#95a5a6";
    flowEdges.push({
      id: `e-${i}`,
      source: edge.source,
      target: edge.target,
      markerEnd: { type: MarkerType.ArrowClosed, color },
      style: { stroke: color, strokeWidth: 1.5, opacity: 0.7 },
    });
  });

  return { nodes: flowNodes, edges: flowEdges };
}

function InvestigationGraphView({ graphData }: { graphData: GraphData }) {
  const { nodes: initNodes, edges: initEdges } = buildFlowGraph(graphData);
  const [nodes, , onNodesChange] = useNodesState(initNodes);
  const [edges, , onEdgesChange] = useEdgesState(initEdges);
  const [selected, setSelected] = useState<GraphNodeData | null>(null);

  return (
    <div>
      <div className="graph-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => setSelected(node.data as unknown as GraphNodeData)}
          fitView
          attributionPosition="bottom-right"
        >
          <Controls />
          <MiniMap />
          <Background gap={16} />
        </ReactFlow>
      </div>
      <div className="graph-legend">
        {Object.entries(RISK_COLORS).map(([label, color]) => (
          <div className="legend-item" key={label}>
            <div className="legend-dot" style={{ background: color }} />
            <span style={{ fontSize: ".75rem", color: "#4a6960" }}>
              {label.replace("_", " ")}
            </span>
          </div>
        ))}
      </div>
      {selected && (
        <div className="graph-node-info">
          <p className="eyebrow">SELECTED NODE</p>
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: ".6rem", marginTop: ".5rem" }}
          >
            <div>
              <small style={{ color: "#5d736e" }}>Student</small>
              <p style={{ margin: 0, fontWeight: 700 }}>{selected.label}</p>
            </div>
            <div>
              <small style={{ color: "#5d736e" }}>Risk</small>
              <p style={{ margin: 0 }}>
                {selected.role === "INDEX_CASE" ? (
                  <RiskBadge category="index" />
                ) : (
                  <RiskBadge
                    category={selected.category ?? "low"}
                    score={selected.risk_score}
                  />
                )}
              </p>
            </div>
            <div>
              <small style={{ color: "#5d736e" }}>Graph distance</small>
              <p style={{ margin: 0, fontWeight: 700 }}>
                {selected.graph_distance != null
                  ? `Depth ${selected.graph_distance}`
                  : "Index case"}
              </p>
            </div>
            {selected.confidence != null && (
              <div>
                <small style={{ color: "#5d736e" }}>Confidence</small>
                <p style={{ margin: 0, fontWeight: 700 }}>
                  {Math.round(selected.confidence * 100)}%
                </p>
              </div>
            )}
          </div>
          <p style={{ fontSize: ".75rem", color: "#7d9790", marginTop: ".5rem" }}>
            {graphData.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}

function AdminInvestigationDetail() {
  const { session } = useAuth();
  const id = window.location.pathname.split("/").pop();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"graph" | "contacts" | "summary">("summary");

  useEffect(() => {
    if (!id || isNaN(Number(id))) return;
    api<GraphData>(`/investigations/${id}`, session!.token)
      .then(setGraphData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, session]);

  const contacts = graphData?.nodes.filter((n) => n.role !== "INDEX_CASE") ?? [];
  const indexNode = graphData?.nodes.find((n) => n.role === "INDEX_CASE");
  const highRisk = contacts.filter((c) => c.category === "HIGH" || c.category === "ELEVATED");

  const riskDist = contacts.reduce<Record<string, number>>(
    (acc, c) => {
      acc[c.category ?? "LOW"] = (acc[c.category ?? "LOW"] ?? 0) + 1;
      return acc;
    },
    {}
  );
  const pieData = Object.entries(riskDist).map(([category, count]) => ({
    name: category,
    value: count,
    color: RISK_COLORS[category] ?? "#95a5a6",
  }));

  return (
    <Shell>
      <PageHeader
        eyebrow="ADMINISTRATOR"
        title={`Investigation #${id}`}
        detail="Bounded BFS exposure investigation results. All data is synthetic."
        actions={
          <Link to="/admin/investigations" className="btn-secondary">
            ← All investigations
          </Link>
        }
      />
      <DemoStrip />

      {loading && <State kind="loading" text="Loading investigation graph…" />}
      {error && <State kind="error" text={error} />}

      {graphData && (
        <>
          {/* Summary cards */}
          <div className="grid grid-4">
            <div className="metric">
              <p>Total contacts</p>
              <strong>{contacts.length}</strong>
              <small>Graph depth {graphData.max_depth}</small>
            </div>
            <div className="metric">
              <p>High / elevated</p>
              <strong className="trend-up">{highRisk.length}</strong>
              <small>Notified</small>
            </div>
            <div className="metric">
              <p>Status</p>
              <strong style={{ fontSize: "1.2rem" }}>{graphData.status}</strong>
              <small>Investigation state</small>
            </div>
            <div className="metric">
              <p>Index case</p>
              <strong style={{ fontSize: "1.2rem" }}>{indexNode?.label ?? "—"}</strong>
              <small>Source student</small>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs mt-3">
            {(
              [
                ["summary", "Summary"],
                ["graph", "Contact graph"],
                ["contacts", "Contact list"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={`tab-btn ${activeTab === key ? "active" : ""}`}
                onClick={() => setActiveTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "summary" && (
            <div className="grid grid-2">
              <div className="card">
                <p className="eyebrow">RISK DISTRIBUTION</p>
                <h2>Contact risk categories</h2>
                <div className="chart-wrapper" style={{ height: 220, marginTop: "1rem" }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="card">
                <p className="eyebrow">HIGH-RISK CONTACTS</p>
                <h2>Elevated &amp; high</h2>
                {highRisk.length === 0 ? (
                  <State kind="empty" text="No high or elevated contacts found." />
                ) : (
                  <div
                    className="stack"
                    style={{ marginTop: ".75rem" }}
                  >
                    {highRisk.slice(0, 8).map((c) => (
                      <div
                        key={c.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: ".5rem .75rem",
                          background: "#f5faf8",
                          borderRadius: ".45rem",
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{c.label}</span>
                        <RiskBadge
                          category={c.category ?? "low"}
                          score={c.risk_score}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "graph" && (
            <div className="card">
              <p className="eyebrow">CONTACT GRAPH</p>
              <h2>Interactive exposure network</h2>
              <p className="text-sm text-muted" style={{ marginBottom: "1rem" }}>
                Click any node to inspect details. Blue = index case, colors
                indicate risk category.
              </p>
              <InvestigationGraphView graphData={graphData} />
            </div>
          )}

          {activeTab === "contacts" && (
            <div className="card">
              <p className="eyebrow">ALL CONTACTS</p>
              <h2>Contact roster ({contacts.length})</h2>
              <div className="table-wrapper" style={{ marginTop: "1rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Risk score</th>
                      <th>Category</th>
                      <th>Confidence</th>
                      <th>Graph depth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <code style={{ fontSize: ".8rem" }}>{c.label}</code>
                        </td>
                        <td>
                          {c.risk_score != null
                            ? `${Math.round(c.risk_score)} / 100`
                            : "—"}
                        </td>
                        <td>
                          <RiskBadge category={c.category ?? "low"} />
                        </td>
                        <td>
                          {c.confidence != null
                            ? `${Math.round(c.confidence * 100)}%`
                            : "—"}
                        </td>
                        <td>Depth {c.graph_distance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card section-card" style={{ fontSize: ".8rem", color: "#5d736e" }}>
            <ShieldCheck size={15} style={{ verticalAlign: "middle", marginRight: ".4rem" }} />
            {graphData.disclaimer}
          </div>
        </>
      )}
      <SafetyFooter />
    </Shell>
  );
}

// ─── Admin Contact Graph (full graph view) ────────────────────────────────────

function AdminGraph() {
  const { session } = useAuth();
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<Investigation[]>("/investigations", session!.token)
      .then((inv) => {
        setInvestigations(inv);
        if (inv.length > 0) setSelected(inv[0].id);
      })
      .catch((e) => setError(e.message));
  }, [session]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api<GraphData>(`/investigations/${selected}`, session!.token)
      .then(setGraphData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selected, session]);

  return (
    <Shell>
      <PageHeader
        eyebrow="ADMINISTRATOR"
        title="Contact graph explorer"
        detail="Interactive network visualisation of exposure contacts. All data is synthetic."
      />
      <DemoStrip />
      <div style={{ marginBottom: "1rem", display: "flex", gap: ".75rem", alignItems: "center", flexWrap: "wrap" }}>
        <label htmlFor="inv-select" style={{ fontWeight: 600, color: "#2e5049" }}>
          Investigation:
        </label>
        <select
          id="inv-select"
          value={selected ?? ""}
          onChange={(e) => setSelected(Number(e.target.value))}
          style={{ maxWidth: "320px" }}
        >
          {investigations.map((inv) => (
            <option key={inv.id} value={inv.id}>
              #{inv.id} — {inv.index_student} / {inv.disease} ({inv.contact_count} contacts)
            </option>
          ))}
        </select>
        {investigations.length === 0 && (
          <Link to="/admin/simulation" className="btn-primary">
            <Cpu size={16} />
            Generate demo data
          </Link>
        )}
      </div>
      {loading && <State kind="loading" text="Loading contact graph…" />}
      {error && <State kind="error" text={error} />}
      {graphData && !loading && (
        <div className="card">
          <InvestigationGraphView graphData={graphData} />
        </div>
      )}
      {!graphData && !loading && !error && investigations.length > 0 && (
        <State kind="empty" text="Select an investigation above." />
      )}
      <SafetyFooter />
    </Shell>
  );
}

// ─── Admin Campus Map ─────────────────────────────────────────────────────────

function AdminMap() {
  const { session } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<unknown>(null);

  useEffect(() => {
    api<Location[]>("/locations", session!.token)
      .then(setLocations)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session]);

  // Initialize Leaflet map after locations load
  useEffect(() => {
    if (loading || error || locations.length === 0 || !mapRef.current) return;
    if (mapInstance.current) return; // already initialized

    import("leaflet").then((L) => {
      if (!mapRef.current) return;
      const map = L.default.map(mapRef.current).setView([19.0722, 72.882], 15);
      mapInstance.current = map;

      L.default
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
        })
        .addTo(map);

      const maxContacts = Math.max(...locations.map((l) => l.contact_events), 1);

      locations.forEach((loc) => {
        const intensity = loc.contact_events / maxContacts;
        const color =
          intensity > 0.7
            ? "#c0392b"
            : intensity > 0.4
            ? "#e67e22"
            : intensity > 0.1
            ? "#f39c12"
            : "#27ae60";
        const radius = 20 + intensity * 40;

        L.default
          .circle([loc.latitude, loc.longitude], {
            color,
            fillColor: color,
            fillOpacity: 0.35,
            weight: 2,
            radius,
          })
          .addTo(map)
          .bindPopup(
            `<strong>${loc.name}</strong><br>` +
              `Type: ${loc.environment_type}<br>` +
              `Contact events: ${loc.contact_events}<br>` +
              `<em style="font-size:0.75rem">Synthetic data only</em>`
          );

        L.default
          .marker([loc.latitude, loc.longitude])
          .addTo(map)
          .bindTooltip(loc.name);
      });
    });

    return () => {
      if (mapInstance.current) {
        (mapInstance.current as { remove: () => void }).remove();
        mapInstance.current = null;
      }
    };
  }, [loading, error, locations]);

  return (
    <Shell>
      <PageHeader
        eyebrow="ADMINISTRATOR"
        title="Campus map"
        detail="Contact density overlay on a fictional campus layout. All data is synthetic."
      />
      <DemoStrip />
      {loading && <State kind="loading" text="Loading campus locations…" />}
      {error && <State kind="error" text={error} />}
      {!loading && !error && (
        <div className="card">
          <div className="map-container" ref={mapRef} />
          <div className="map-legend" style={{ marginTop: ".75rem" }}>
            <span style={{ fontSize: ".75rem", color: "#5d736e", fontWeight: 700 }}>
              Contact density:
            </span>
            {[
              { label: "High", color: "#c0392b" },
              { label: "Medium-high", color: "#e67e22" },
              { label: "Medium", color: "#f39c12" },
              { label: "Low", color: "#27ae60" },
            ].map(({ label, color }) => (
              <div className="legend-item" key={label}>
                <div className="legend-dot" style={{ background: color }} />
                <span style={{ fontSize: ".75rem", color: "#4a6960" }}>{label}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: ".78rem", color: "#7d9790", marginTop: ".5rem" }}>
            Circles represent contact density at each location. Radius and color indicate
            relative contact event frequency. This is synthetic demonstration data.
          </p>
        </div>
      )}
      {!loading && !error && locations.length > 0 && (
        <div className="card section-card">
          <p className="eyebrow">LOCATION DETAIL</p>
          <h2>Campus locations</h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Environment</th>
                  <th>Contact events</th>
                </tr>
              </thead>
              <tbody>
                {[...locations]
                  .sort((a, b) => b.contact_events - a.contact_events)
                  .map((loc) => (
                    <tr key={loc.id}>
                      <td>{loc.name}</td>
                      <td>
                        <span className="badge">{loc.environment_type}</span>
                      </td>
                      <td>{loc.contact_events}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <SafetyFooter />
    </Shell>
  );
}

// ─── Admin Analytics ──────────────────────────────────────────────────────────

type AnalyticsData = {
  risk_distribution: { category: string; count: number }[];
  case_timeline: { date: string; cases: number }[];
  location_density: { name: string; contacts: number; environment: string }[];
  depth_risk_breakdown: Record<string, Record<string, number>>;
  total_students_in_graph: number;
};

const RISK_CHART_COLORS: Record<string, string> = {
  LOW: "#27ae60",
  MODERATE: "#f39c12",
  ELEVATED: "#e67e22",
  HIGH: "#c0392b",
};

function AdminAnalytics() {
  const { session } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AnalyticsData>("/admin/analytics", session!.token)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session]);

  if (loading) return <Shell><State kind="loading" text="Loading analytics…" /></Shell>;
  if (error) return <Shell><State kind="error" text={error} /></Shell>;
  if (!data) return null;

  const d1Data = Object.entries(data.depth_risk_breakdown["1"] ?? {}).map(
    ([cat, cnt]) => ({ category: cat, count: cnt })
  );
  const d2Data = Object.entries(data.depth_risk_breakdown["2"] ?? {}).map(
    ([cat, cnt]) => ({ category: cat, count: cnt })
  );

  return (
    <Shell>
      <PageHeader
        eyebrow="ADMINISTRATOR"
        title="Analytics"
        detail="Exposure network analytics derived from synthetic simulation data."
      />
      <DemoStrip />

      <div className="grid grid-2">
        {/* Risk distribution pie */}
        <div className="card">
          <p className="eyebrow">RISK DISTRIBUTION</p>
          <h2>Notification risk categories</h2>
          <div className="chart-wrapper" style={{ height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data.risk_distribution}
                  dataKey="count"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {data.risk_distribution.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={RISK_CHART_COLORS[entry.category] ?? "#95a5a6"}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Case timeline bar chart */}
        <div className="card">
          <p className="eyebrow">CASES OVER TIME</p>
          <h2>Cases by day</h2>
          <div className="chart-wrapper" style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={data.case_timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0eeea" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="cases" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Location density bar */}
        <div className="card">
          <p className="eyebrow">CONTACT DENSITY BY LOCATION</p>
          <h2>Top locations</h2>
          <div className="chart-wrapper" style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart
                data={data.location_density.slice(0, 8)}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e0eeea" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 10 }}
                  width={90}
                />
                <Tooltip />
                <Bar dataKey="contacts" fill="#0f766e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Depth risk breakdown */}
        <div className="card">
          <p className="eyebrow">RISK BY GRAPH DEPTH</p>
          <h2>Depth 1 vs Depth 2 contacts</h2>
          <div className="chart-wrapper" style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={[
                ...d1Data.map(d => ({ ...d, depth: "Depth 1" })),
                ...d2Data.map(d => ({ ...d, depth: "Depth 2" })),
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0eeea" />
                <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Contacts" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card section-card">
        <p className="eyebrow">SUMMARY</p>
        <p>
          <strong>{data.total_students_in_graph}</strong> students are captured in
          the contact investigation graph across all investigations. All data is
          synthetic and for demonstration purposes only.
        </p>
      </div>
      <SafetyFooter />
    </Shell>
  );
}

// ─── Admin Students ───────────────────────────────────────────────────────────

type StudentRecord = {
  id: number;
  student_code: string;
  course: string;
  risk_score: number | null;
  risk_category: string;
};

function AdminStudents() {
  const { session } = useAuth();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api<StudentRecord[]>("/admin/students", session!.token)
      .then(setStudents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session]);

  const filtered = students.filter(
    (s) =>
      !filter ||
      s.student_code.toLowerCase().includes(filter.toLowerCase()) ||
      s.course.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Shell>
      <PageHeader
        eyebrow="ADMINISTRATOR"
        title="Students"
        detail="Sorted by highest exposure risk. All data is synthetic."
      />
      <DemoStrip />
      <div className="card">
        <div style={{ marginBottom: "1rem" }}>
          <input
            placeholder="Search by student code or course…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ maxWidth: "320px" }}
          />
        </div>
        {loading ? (
          <State kind="loading" text="Loading students…" />
        ) : error ? (
          <State kind="error" text={error} />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Student code</th>
                  <th>Course</th>
                  <th>Highest risk</th>
                  <th>Risk score</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <code style={{ fontSize: ".8rem" }}>{s.student_code}</code>
                    </td>
                    <td style={{ color: "#5a7c74" }}>{s.course}</td>
                    <td>
                      <RiskBadge category={s.risk_category} />
                    </td>
                    <td>
                      {s.risk_score != null
                        ? `${Math.round(s.risk_score)} / 100`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <State kind="empty" text="No students match the current filter." />
            )}
          </div>
        )}
      </div>
      <SafetyFooter />
    </Shell>
  );
}

// ─── Admin Simulation ─────────────────────────────────────────────────────────

function AdminSimulation() {
  const { session } = useAuth();
  const [result, setResult] = useState<Record<string, number | string> | null>(
    null
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api<Record<string, number | string>>(
        "/simulation/generate",
        session!.token,
        { method: "POST" }
      );
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <PageHeader
        eyebrow="ADMINISTRATOR"
        title="Generate demo investigation"
        detail="Creates a fully synthetic campus scenario. Never uses real student, movement, or health data."
      />
      <DemoStrip />
      <div className="card" style={{ maxWidth: "640px" }}>
        <p className="eyebrow">ONE-CLICK DEMO</p>
        <h2>Campus contact simulation</h2>
        <p style={{ marginTop: ".5rem" }}>
          Generates 100 pseudonymous students, 10 fictional campus locations, 1,800
          contact events, an index case, a bounded depth-two traversal, exposure
          estimates, and in-app notifications — entirely synthetic.
        </p>
        <div className="actions">
          <button
            className="btn-primary"
            onClick={run}
            disabled={loading}
          >
            <Cpu size={16} />
            {loading ? "Generating simulation…" : "Generate simulation"}
          </button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {result && (
          <div
            style={{
              marginTop: "1.25rem",
              padding: "1rem",
              background: "#e6f5f0",
              borderRadius: ".65rem",
            }}
          >
            <p className="eyebrow" style={{ marginBottom: ".5rem" }}>
              SIMULATION COMPLETE
            </p>
            <div
              className="grid grid-2"
              style={{ gap: ".75rem", fontSize: ".88rem" }}
            >
              {[
                ["Students", result.students],
                ["Locations", result.locations],
                ["Contact events", result.contact_events],
                ["Contacts identified", result.contacts_identified],
                ["Case ID", `#${result.case_id}`],
                ["Investigation ID", `#${result.investigation_id}`],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <small style={{ color: "#5d7e78" }}>{label}</small>
                  <p style={{ fontWeight: 700, margin: 0 }}>{value}</p>
                </div>
              ))}
            </div>
            <p
              style={{ fontSize: ".8rem", color: "#1d5e50", marginTop: ".75rem" }}
            >
              Investigation #{result.investigation_id} is ready. All data is
              synthetic and estimates are non-diagnostic.
            </p>
            <div className="actions">
              <button
                className="btn-secondary"
                onClick={() =>
                  navigate(`/admin/investigations/${result.investigation_id}`)
                }
              >
                View investigation →
              </button>
              <button
                className="btn-secondary"
                onClick={() => navigate("/admin/map")}
              >
                Campus map →
              </button>
            </div>
          </div>
        )}
      </div>
      <SafetyFooter />
    </Shell>
  );
}

// ─── Admin Audit Trail ────────────────────────────────────────────────────────

type AuditEvent = {
  timestamp: string;
  action: string;
  detail: string;
  actor: string;
};

const ACTION_LABELS: Record<string, string> = {
  CASE_REPORTED: "Case reported",
  INVESTIGATION_STARTED: "Investigation started",
  NOTIFICATION_GENERATED: "Notification generated",
};

function AdminAudit() {
  const { session } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AuditEvent[]>("/admin/audit", session!.token)
      .then(setEvents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session]);

  return (
    <Shell>
      <PageHeader
        eyebrow="ADMINISTRATOR"
        title="Audit trail"
        detail="System-generated event log. No unnecessary sensitive data is stored."
      />
      <DemoStrip />
      <div className="card">
        {loading ? (
          <State kind="loading" text="Loading audit trail…" />
        ) : error ? (
          <State kind="error" text={error} />
        ) : events.length === 0 ? (
          <State kind="empty" text="No audit events yet. Generate a simulation." />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Detail</th>
                  <th>Actor</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: ".78rem", color: "#6d8880", whiteSpace: "nowrap" }}>
                      {ev.timestamp
                        ? new Date(ev.timestamp).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      <span className="badge">
                        {ACTION_LABELS[ev.action] ?? ev.action}
                      </span>
                    </td>
                    <td style={{ color: "#3a5c55" }}>{ev.detail}</td>
                    <td>
                      <span className="badge">{ev.actor}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <SafetyFooter />
    </Shell>
  );
}

// ─── useRef import ────────────────────────────────────────────────────────────
import { useRef } from "react";

// ─── App router ───────────────────────────────────────────────────────────────

function App() {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const raw = localStorage.getItem("campus-trace-session");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const token = parsed.token || parsed.access_token;
      if (token && parsed.role) {
        return { token, access_token: token, role: parsed.role };
      }
      return null;
    } catch {
      return null;
    }
  });

  const home =
    session?.role === "ADMIN"
      ? "/admin/dashboard"
      : session?.role === "TEACHER"
      ? "/teacher/dashboard"
      : "/student/dashboard";

  return (
    <Auth.Provider value={{ session, setSession }}>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Student */}
        <Route
          path="/student/dashboard"
          element={
            <Protected role="STUDENT">
              <StudentDashboard />
            </Protected>
          }
        />
        <Route
          path="/student/notifications"
          element={
            <Protected role="STUDENT">
              <Notifications />
            </Protected>
          }
        />
        <Route
          path="/student/report-case"
          element={
            <Protected role="STUDENT">
              <ReportCase />
            </Protected>
          }
        />

        {/* Teacher */}
        <Route
          path="/teacher/dashboard"
          element={
            <Protected role="TEACHER">
              <TeacherDashboard />
            </Protected>
          }
        />
        <Route
          path="/teacher/classes"
          element={
            <Protected role="TEACHER">
              <TeacherClasses />
            </Protected>
          }
        />

        {/* Admin */}
        <Route
          path="/admin/dashboard"
          element={
            <Protected role="ADMIN">
              <AdminDashboard />
            </Protected>
          }
        />
        <Route
          path="/admin/investigations"
          element={
            <Protected role="ADMIN">
              <AdminInvestigations />
            </Protected>
          }
        />
        <Route
          path="/admin/investigations/:id"
          element={
            <Protected role="ADMIN">
              <AdminInvestigationDetail />
            </Protected>
          }
        />
        <Route
          path="/admin/graph"
          element={
            <Protected role="ADMIN">
              <AdminGraph />
            </Protected>
          }
        />
        <Route
          path="/admin/map"
          element={
            <Protected role="ADMIN">
              <AdminMap />
            </Protected>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <Protected role="ADMIN">
              <AdminAnalytics />
            </Protected>
          }
        />
        <Route
          path="/admin/students"
          element={
            <Protected role="ADMIN">
              <AdminStudents />
            </Protected>
          }
        />
        <Route
          path="/admin/simulation"
          element={
            <Protected role="ADMIN">
              <AdminSimulation />
            </Protected>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <Protected role="ADMIN">
              <AdminAudit />
            </Protected>
          }
        />

        {/* Fallback */}
        <Route
          path="*"
          element={<Navigate to={session ? home : "/login"} replace />}
        />
      </Routes>
    </Auth.Provider>
  );
}

// ─── Mount ────────────────────────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
