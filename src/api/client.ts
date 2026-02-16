/**
 * Base API client for communicating with the Java backend.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * HTTP error with status code and response body.
 */
export class ApiError extends Error {
  status: number;
  statusText: string;
  body?: unknown;

  constructor(status: number, statusText: string, body?: unknown) {
    super(`API Error ${status}: ${statusText}`);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

/**
 * Network error when backend is unreachable.
 */
export class NetworkError extends Error {
  cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

/**
 * Make an API request with automatic JSON handling.
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    // Network error - backend unreachable, DNS failure, CORS blocked, etc.
    throw new NetworkError(
      `Unable to reach the server at ${API_BASE_URL}. Please check your connection and try again.`,
      err instanceof Error ? err : undefined
    );
  }

  // Read body once and reuse - response body can only be consumed once
  const text = await response.text();

  if (!response.ok) {
    // Try to parse as JSON for structured error, fall back to raw text
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }
    throw new ApiError(response.status, response.statusText, body);
  }

  // Check for HTML responses (Vite fallback when backend not running)
  if (text.startsWith('<!') || text.startsWith('<html')) {
    throw new ApiError(
      500,
      'Received HTML instead of JSON',
      `Endpoint ${url} returned HTML. Backend may not be running or proxy misconfigured.`
    );
  }

  // Handle empty responses
  if (!text) {
    return undefined as T;
  }

  // Parse JSON
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(500, 'Invalid JSON response', text.substring(0, 200));
  }
}

/**
 * GET request.
 */
export async function get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url = `${endpoint}?${searchParams.toString()}`;
  }
  return request<T>(url, { method: 'GET' });
}

/**
 * POST request.
 */
export async function post<T>(endpoint: string, body?: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT request.
 */
export async function put<T>(endpoint: string, body?: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request.
 */
export async function del<T>(endpoint: string): Promise<T> {
  return request<T>(endpoint, { method: 'DELETE' });
}

export default {
  get,
  post,
  put,
  del,
  ApiError,
  NetworkError,
};
