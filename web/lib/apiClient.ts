import { getAuthSnapshot, hydrateAuthStore } from "@/lib/auth-store";
import { getTenantIdFromBrowserHost } from "@/lib/tenant-host";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

type ApiMethod = "GET" | "POST";

type ApiRequestOptions = {
  tenantId?: string;
  withAuth?: boolean;
};

export type ApiErrorPayload = {
  message: string;
  code?: string;
  fieldErrors?: Record<string, string>;
  issues?: unknown;
};

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly fieldErrors: Record<string, string>;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message || `API error (${status})`);
    this.status = status;
    this.code = payload.code;
    this.fieldErrors = payload.fieldErrors ?? {};
  }
}

const buildHeaders = (options?: ApiRequestOptions): HeadersInit => {
  hydrateAuthStore();

  const snapshot = getAuthSnapshot();
  const tenantId = options?.tenantId ?? snapshot.tenantId ?? getTenantIdFromBrowserHost();

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (options?.withAuth !== false && snapshot.token) {
    headers.Authorization = `Bearer ${snapshot.token}`;
  }

  if (tenantId) {
    headers["X-Tenant-ID"] = tenantId;
  }

  return headers;
};

export async function apiRequest<T>(path: string, method: ApiMethod, body?: unknown, options?: ApiRequestOptions): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: buildHeaders(options),
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
  } catch {
    throw new ApiError(503, {
      message: "Nao foi possivel conectar na API. Verifique se o backend esta rodando.",
      code: "API_UNREACHABLE",
      fieldErrors: {}
    });
  }

  if (!response.ok) {
    let payload: ApiErrorPayload;

    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      const message = await response.text();
      payload = { message: message || `API error (${response.status})`, fieldErrors: {} };
    }

    throw new ApiError(response.status, payload);
  }

  return (await response.json()) as T;
}

export { API_BASE };
