// Central type definitions for Campus Trace frontend

export type Role = "STUDENT" | "TEACHER" | "ADMIN";

export interface Session {
  token: string;
  role: Role;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  risk_score: number;
  category: string;
  is_acknowledged: boolean;
  created_at: string;
}

export interface Investigation {
  id: number;
  case_id: number;
  status: string;
  max_depth: number;
  index_student: string;
  disease: string;
  contact_count: number;
  created_at: string | null;
}

export interface GraphNode {
  id: string;
  label: string;
  role: "INDEX_CASE" | "CONTACT";
  risk_score: number | null;
  category?: string;
  confidence?: number;
  graph_distance?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  graph_distance?: number;
}

export interface GraphData {
  investigation_id: number;
  status: string;
  max_depth: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  disclaimer: string;
}

export interface Location {
  id: number;
  name: string;
  environment_type: string;
  latitude: number;
  longitude: number;
  contact_events: number;
}

export interface CaseRecord {
  id: number;
  student_code: string;
  disease: string;
  date_reported: string;
  status: string;
  created_at: string | null;
}

export interface StudentRecord {
  id: number;
  student_code: string;
  course: string;
  risk_score: number | null;
  risk_category: string;
}

export interface AnalyticsData {
  label: string;
  risk_distribution: { category: string; count: number }[];
  case_timeline: { date: string; cases: number }[];
  location_density: { name: string; contacts: number; environment: string }[];
  depth_risk_breakdown: Record<string, Record<string, number>>;
  total_students_in_graph: number;
  disclaimer: string;
}

export interface AuditEvent {
  timestamp: string;
  action: string;
  detail: string;
  actor: string;
}
