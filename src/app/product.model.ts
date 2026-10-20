/** Mirrors ProductResponse in the Spring app: what the API gives back. */
export interface Product {
  id: number;
  name: string;
  price: number;
  createdAt: string;
}

/**
 * Mirrors ProductRequest. No id and no createdAt on purpose - the server assigns both, and
 * leaving them out of this type is what stops the UI from trying to send them.
 */
export interface ProductRequest {
  name: string;
  price: number;
}

/**
 * RFC 7807 body, as produced by ApiExceptionHandler. `errors` is only present on a 400 from
 * a failed @Valid, and its keys are field names - 'name', 'price' - which is what lets the
 * form attach each message to the control it belongs to.
 */
export interface ProblemDetail {
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string>;
}

/**
 * One HTTP exchange, as the inspector shows it. Deliberately records failures the same way
 * as successes: a 404 is a fact about the API worth displaying, not an error to swallow.
 */
export interface ApiCall {
  method: string;
  url: string;
  status: number;
  statusText: string;
  durationMs: number;
  location: string | null;
  /** The ETag the server returned: the concurrency token for the next write. */
  etag: string | null;
  /** The If-Match this request carried, if any - shown so the exchange reads as a pair. */
  ifMatch: string | null;
  body: unknown;
  /** Set when the request never reached the server at all - API down, proxy misconfigured. */
  transportError: string | null;
}

export function isProblemDetail(body: unknown): body is ProblemDetail {
  return typeof body === 'object' && body !== null && 'status' in body;
}
