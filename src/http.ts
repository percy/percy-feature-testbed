/**
 * Minimal injectable HTTP client. The default uses global `fetch`; tests inject a
 * fake so the Percy REST layer is verifiable without live calls (plan: validate later).
 */
export interface HttpRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  /** object => JSON-encoded; string => sent as-is */
  body?: unknown;
  contentType?: string;
}

export interface HttpResponse {
  status: number;
  ok: boolean;
  body: unknown;
  text: string;
}

export type HttpClient = (req: HttpRequest) => Promise<HttpResponse>;

export const fetchHttpClient: HttpClient = async (req) => {
  const headers: Record<string, string> = { ...(req.headers ?? {}) };
  let body: string | undefined;
  if (req.body !== undefined) {
    if (typeof req.body === 'string') {
      body = req.body;
    } else {
      body = JSON.stringify(req.body);
      headers['content-type'] = req.contentType ?? 'application/json';
    }
  } else if (req.contentType) {
    headers['content-type'] = req.contentType;
  }

  const res = await fetch(req.url, { method: req.method, headers, body });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }
  return { status: res.status, ok: res.ok, body: parsed, text };
};
