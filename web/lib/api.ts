const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

type ApiMethod = "GET" | "POST";

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
    const message = await response.text();
    throw new Error(message || `API error (${response.status})`);
  }

  return (await response.json()) as T;
}

export { API_BASE };
