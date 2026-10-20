import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiCall, Product, ProductRequest } from './product.model';

/**
 * One method per endpoint of the Spring app, each returning the full {@link ApiCall} rather
 * than just the parsed body.
 *
 * Two things make this service look unusual, and both are the point of this app:
 *
 * 1. Every request uses `observe: 'response'`. With the default (`observe: 'body'`) the
 *    status code and the headers are discarded by HttpClient before we see them, which
 *    would make the 201 Location header and the empty 204 impossible to display.
 * 2. Error responses are mapped into the same ApiCall shape as successes instead of being
 *    rethrown. A 404 from GET /products/{id} is a documented behaviour of the API we want
 *    to look at, so it must not blow up the stream - the caller gets a normal value back
 *    and reads `status` to find out what happened.
 *
 * All URLs are relative. They must stay that way: proxy.conf.json forwards /products to
 * :8081, so the browser only ever talks to its own origin and CORS never comes into it.
 * Hardcoding http://localhost:8081 here is what would break that.
 */
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

  private readonly lastCallSignal = signal<ApiCall | null>(null);
  private readonly historySignal = signal<ApiCall[]>([]);

  /** The exchange the inspector renders. */
  readonly lastCall = this.lastCallSignal.asReadonly();

  /** Most recent first, capped - enough to compare two calls without growing unbounded. */
  readonly history = this.historySignal.asReadonly();

  /**
   * `silent` keeps the call out of the inspector. The refresh that follows a create or a
   * delete is bookkeeping, not something the user asked for, and recording it would
   * immediately overwrite the 201 (and its Location header) or the 204 they wanted to look
   * at - the one response this whole app exists to show.
   */
  list(options: { silent?: boolean } = {}): Observable<ApiCall> {
    return this.track(
      'GET',
      '/products',
      this.http.get<Product[]>('/products', { observe: 'response' }),
      options.silent ?? false,
    );
  }

  get(id: string): Observable<ApiCall> {
    const url = `/products/${encodeURIComponent(id)}`;
    return this.track('GET', url, this.http.get<Product>(url, { observe: 'response' }));
  }

  create(request: ProductRequest): Observable<ApiCall> {
    return this.track(
      'POST',
      '/products',
      this.http.post<Product>('/products', request, { observe: 'response' }),
    );
  }

  update(id: string, request: ProductRequest): Observable<ApiCall> {
    const url = `/products/${encodeURIComponent(id)}`;
    return this.track('PUT', url, this.http.put<Product>(url, request, { observe: 'response' }));
  }

  /**
   * 204 carries no body, so the response type is void and `body` lands as null. Asking
   * HttpClient to parse JSON out of an empty 204 is how this would throw instead.
   */
  delete(id: string): Observable<ApiCall> {
    const url = `/products/${encodeURIComponent(id)}`;
    return this.track('DELETE', url, this.http.delete<void>(url, { observe: 'response' }));
  }

  private track(
    method: string,
    url: string,
    request: Observable<HttpResponse<unknown>>,
    silent = false,
  ): Observable<ApiCall> {
    const startedAt = performance.now();

    return request.pipe(
      map((response) => this.toCall(method, url, startedAt, response)),
      catchError((error: HttpErrorResponse) => of(this.toCall(method, url, startedAt, error))),
      map((call) => (silent ? call : this.record(call))),
    );
  }

  private toCall(
    method: string,
    url: string,
    startedAt: number,
    response: HttpResponse<unknown> | HttpErrorResponse,
  ): ApiCall {
    const isError = response instanceof HttpErrorResponse;

    return {
      method,
      url,
      status: response.status,
      statusText: response.statusText,
      durationMs: Math.round(performance.now() - startedAt),
      location: response.headers?.get('Location') ?? null,
      body: isError ? response.error : response.body,
      // status 0 means the request never got a response: backend down, or the proxy is not
      // forwarding. Worth distinguishing, because every other field is meaningless then.
      transportError: isError && response.status === 0 ? response.message : null,
    };
  }

  private record(call: ApiCall): ApiCall {
    this.lastCallSignal.set(call);
    this.historySignal.update((history) => [call, ...history].slice(0, 20));

    return call;
  }
}
