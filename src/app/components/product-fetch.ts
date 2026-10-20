import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

/**
  * Direct access to /products/:id with an arbitrary id, which is the only way to reach the
 * API's failure paths from a UI: the table can only ever offer ids that exist, so 404 and
 * the 400-on-unbindable-id would otherwise be untestable here.
 */
@Component({
  selector: 'app-product-fetch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <h2>/products/:id</h2>

      <div class="row">
        <input [value]="id()" (input)="id.set(asValue($event))" placeholder="1" aria-label="product id" />
        <button type="button" (click)="fetch.emit(id())" [disabled]="busy() || !id()">GET</button>
        <button type="button" class="danger" (click)="remove.emit(id())" [disabled]="busy() || !id()">
          DELETE
        </button>
      </div>

      <p class="hint">
        Try
        @for (example of examples; track example.id) {
          <button type="button" class="link" (click)="id.set(example.id)">{{ example.id }}</button>
          <span class="muted">({{ example.expect }})</span>@if (!$last) { , }
        }
      </p>
    </section>
  `,
  styles: `
    .row { display: flex; gap: .5rem; }
    .row input { flex: 1; padding: .4rem .5rem; border: 1px solid var(--border); border-radius: 4px;
      background: var(--input-bg); color: inherit; font: inherit; }
    .hint { color: var(--muted); font-size: .8rem; margin: .5rem 0 0; }
    .link { background: none; border: none; padding: 0; color: var(--link); cursor: pointer;
      font: inherit; text-decoration: underline; }
    .muted { color: var(--muted); }
  `,
})
export class ProductFetch {
  readonly busy = input(false);

  readonly fetch = output<string>();
  readonly remove = output<string>();

  protected readonly id = signal('1');

  protected readonly examples = [
    { id: '1', expect: '200' },
    { id: '999999', expect: '404' },
    { id: 'abc', expect: '400' },
  ];

  protected asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
