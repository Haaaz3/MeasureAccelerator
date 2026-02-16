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

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    throw new ApiError(response.status, response.statusText, body);
  }

  // Check content-type before parsing
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    const text = await response.text();
    // If it's HTML (Vite fallback), throw a clear error
    if (text.startsWith('<!') || text.startsWith('<html')) {
      throw new ApiError(
        500,
        'Received HTML instead of JSON',
        `Endpoint ${url} returned HTML. Backend may not be running or proxy misconfigured.`
      );
    }
    // Empty response
    if (!text) {
      return undefined as T;
    }
    // Try to parse anyway (some backends don't set content-type)
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError(500, 'Invalid JSON response', text.substring(0, 200));
    }
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
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
};
