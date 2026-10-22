import type {
  AnalysisResponse,
  DashboardSummary,
  DocumentRead,
  DocumentStatus,
  ReportFormat,
} from "../types";

// Defaults to the Vite proxy path. Set VITE_API_BASE to call a backend on another origin.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api/v1";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") {
      return body.detail;
    }
  } catch {
    // Non-JSON error body; fall through to the generic message.
  }
  return `Request failed with status ${response.status}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
    ...init,
  });
  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }
  return (await response.json()) as T;
}

export function listDocuments(status?: DocumentStatus): Promise<DocumentRead[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<DocumentRead[]>(`/documents/${query}`);
}

export function getDocument(documentId: string): Promise<DocumentRead> {
  return request<DocumentRead>(`/documents/${encodeURIComponent(documentId)}`);
}

export function getAnalysis(documentId: string): Promise<AnalysisResponse> {
  return request<AnalysisResponse>(`/documents/${encodeURIComponent(documentId)}/analysis`);
}

export function uploadDocument(file: File): Promise<DocumentRead> {
  const form = new FormData();
  form.append("file", file);
  // The browser sets the multipart boundary header itself, so Content-Type is not set here.
  return request<DocumentRead>("/documents/upload", { method: "POST", body: form });
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return request<DashboardSummary>("/dashboard/summary");
}

export async function downloadReport(format: ReportFormat): Promise<void> {
  const response = await fetch(`${API_BASE}/reports/export?format=${format}`);
  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `audit_report.${format}`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
