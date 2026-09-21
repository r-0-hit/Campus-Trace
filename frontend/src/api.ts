// API client – all requests go through this module

import type { Session } from "./types";

const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

export async function api<T>(
  path: string,
  token?: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? "The request could not be completed.");
  }
  return res.json() as Promise<T>;
}

// Typed helpers

export const login = (username: string, password: string) =>
  api<Session>("/auth/login", undefined, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

export const getMe = (token: string) =>
  api<{ id: number; username: string; full_name: string; role: string; student_code: string | null }>("/students/me", token);

export const getMyExposure = (token: string) =>
  api<import("./types").Notification[]>("/students/me/exposure", token);

export const getNotifications = (token: string) =>
  api<import("./types").Notification[]>("/notifications", token);

export const acknowledgeNotification = (id: number, token: string) =>
  api<{ status: string }>(`/notifications/${id}/acknowledge`, token, { method: "POST" });

export const respondToSymptoms = (id: number, response: "YES" | "NO" | "NOT_SURE", token: string) =>
  api<{ status: string; message: string }>(`/notifications/${id}/symptom-response`, token, {
    method: "POST",
    body: JSON.stringify({ response }),
  });

export const getDiseases = (token: string) =>
  api<{ id: number; name: string; symptoms: string[]; is_demo: boolean }[]>("/diseases", token);

export const reportCase = (payload: { disease_id: number; date_reported: string; symptom_onset?: string; symptoms?: string[]; notes?: string }, token: string) =>
  api<{ id: number; disease: string; date_reported: string; status: string }>("/cases/report", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const listCases = (token: string) =>
  api<import("./types").CaseRecord[]>("/cases", token);

export const getCase = (id: number, token: string) =>
  api<import("./types").CaseRecord & { symptom_onset: string | null; symptoms: string[]; notes: string | null }>(`/cases/${id}`, token);

export const getInvestigations = (token: string) =>
  api<import("./types").Investigation[]>("/investigations", token);

export const getInvestigation = (id: number, token: string) =>
  api<import("./types").GraphData>(`/investigations/${id}`, token);

export const getAdminDashboard = (token: string) =>
  api<Record<string, number | string>>("/admin/dashboard", token);

export const getAdminAnalytics = (token: string) =>
  api<import("./types").AnalyticsData>("/admin/analytics", token);

export const getAdminStudents = (token: string) =>
  api<import("./types").StudentRecord[]>("/admin/students", token);

export const getAdminAudit = (token: string) =>
  api<import("./types").AuditEvent[]>("/admin/audit", token);

export const getLocations = (token: string) =>
  api<import("./types").Location[]>("/locations", token);

export const getTeacherDashboard = (token: string) =>
  api<Record<string, unknown>>("/teacher/dashboard", token);

export const generateSimulation = (token: string) =>
  api<Record<string, number | string>>("/simulation/generate", token, { method: "POST" });

export const startInvestigation = (case_id: number, token: string) =>
  api<import("./types").GraphData>(`/investigations/start?case_id=${case_id}`, token, { method: "POST" });
