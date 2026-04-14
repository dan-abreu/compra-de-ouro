const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002/api";

type ApiMethod = "GET" | "POST";

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

export async function apiRequest<T>(path: string, method: ApiMethod, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });

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
