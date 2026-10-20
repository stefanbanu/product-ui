import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ApiCall, isProblemDetail } from '../product.model';

/**
 * Shows what actually came back over the wire: status, duration, Location, and the body.
 * This panel is the reason the app exists - a plain CRUD screen would show the 10 products
 * equally well but would hide the 201 vs 200 vs 204 distinction entirely.
 */
@Component({
  selector: 'app-response-inspector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <h2>Last response</h2>

      @if (call(); as c) {
        <div class="line">
          <code class="method">{{ c.method }}</code>
          <code class="url">{{ c.url }}</code>
        </div>

        @if (c.transportError) {
          <p class="status status-0">
            No response — is the API running on :8081?
          </p>
          <pre class="body">{{ c.transportError }}</pre>
        } @else {
          <div class="line">
            <span class="status" [class]="statusClass()">{{ c.status }} {{ c.statusText }}</span>
            <span class="duration">{{ c.durationMs }} ms</span>
          </div>

          @if (c.ifMatch) {
            <div class="line">
              <span class="label">sent If-Match</span>
              <code class="token">{{ c.ifMatch }}</code>
            </div>
          }

          @if (c.etag) {
            <div class="line">
              <span class="label">got ETag</span>
              <code class="token">{{ c.etag }}</code>
            </div>
          }

          @if (c.location) {
            <div class="line">
              <span class="label">Location</span>
              <a class="location" [href]="c.location">{{ c.location }}</a>
            </div>
          }

          @if (fieldErrors().length) {
            <div class="errors">
              <span class="label">Field errors</span>
              <ul>
                @for (error of fieldErrors(); track error.field) {
                  <li><code>{{ error.field }}</code> {{ error.message }}</li>
                }
              </ul>
            </div>
          }

          @if (c.status === 204) {
            <p class="empty">204 No Content — empty body, as specified.</p>
          } @else {
            <pre class="body">{{ pretty() }}</pre>
          }
        }
      } @else {
        <p class="empty">No calls yet. Use the panels on the left.</p>
      }
    </section>
  `,
  styles: `
    .panel { position: sticky; top: 1rem; }
    .line { display: flex; gap: .5rem; align-items: baseline; margin-bottom: .5rem; flex-wrap: wrap; }
    .method { font-weight: 700; }
    .url { color: var(--muted); overflow-wrap: anywhere; }
    .status { font-weight: 700; padding: .1rem .45rem; border-radius: 4px; }
    .status-2xx { background: #15803d; color: #fff; }
    .status-4xx { background: #b45309; color: #fff; }
    .status-5xx { background: #b91c1c; color: #fff; }
    .status-0   { background: #4b5563; color: #fff; }
    .duration { color: var(--muted); font-variant-numeric: tabular-nums; }
    .label { color: var(--muted); font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; }
    .location { overflow-wrap: anywhere; }
    .token { background: var(--code-bg); padding: .05rem .35rem; border-radius: 3px; }
    .errors ul { margin: .25rem 0 .75rem; padding-left: 1.2rem; }
    .body { background: var(--code-bg); padding: .75rem; border-radius: 6px; overflow-x: auto;
            max-height: 60vh; font-size: .85rem; }
    .empty { color: var(--muted); }
  `,
})
export class ResponseInspector {
  readonly call = input<ApiCall | null>(null);

  protected readonly statusClass = computed(() => {
    const status = this.call()?.status ?? 0;

    if (status === 0) return 'status-0';
    return `status-${Math.floor(status / 100)}xx`;
  });

  protected readonly pretty = computed(() => {
    const body = this.call()?.body;

    if (body === null || body === undefined || body === '') return '(empty body)';
    return JSON.stringify(body, null, 2);
  });

  /** Flattens the ProblemDetail errors map so @for has something trackable. */
  protected readonly fieldErrors = computed(() => {
    const body = this.call()?.body;

    if (!isProblemDetail(body) || !body.errors) return [];
    return Object.entries(body.errors).map(([field, message]) => ({ field, message }));
  });
}
