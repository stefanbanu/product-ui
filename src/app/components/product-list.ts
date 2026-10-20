import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Product } from '../product.model';

/** GET /products as a table, with the per-row entry points into PUT and DELETE. */
@Component({
  selector: 'app-product-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header>
        <h2>Products <span class="count">({{ products().length }})</span></h2>
        <button type="button" (click)="refresh.emit()" [disabled]="busy()">
          GET /products
        </button>
      </header>

      @if (products().length) {
        <table>
          <thead>
            <tr><th>id</th><th>name</th><th class="num">price</th><th>createdAt</th><th></th></tr>
          </thead>
          <tbody>
            @for (product of products(); track product.id) {
              <tr>
                <td class="num">{{ product.id }}</td>
                <td>{{ product.name }}</td>
                <td class="num">{{ product.price }}</td>
                <!-- Raw, not a date pipe: seeing the exact ISO instant the API returned is
                     the point, and it is what makes an unchanged createdAt after a PUT
                     verifiable by eye. -->
                <td class="stamp">{{ product.createdAt }}</td>
                <td class="actions">
                  <button type="button" (click)="edit.emit(product)" [disabled]="busy()">Edit</button>
                  <button type="button" class="danger" (click)="remove.emit(product)" [disabled]="busy()">
                    Delete
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <p class="empty">Nothing loaded. Press GET /products.</p>
      }
    </section>
  `,
  styles: `
    header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    .count { color: var(--muted); font-weight: 400; }
    table { width: 100%; border-collapse: collapse; font-size: .9rem; }
    th, td { text-align: left; padding: .35rem .5rem; border-bottom: 1px solid var(--border); }
    th { color: var(--muted); font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .stamp { color: var(--muted); font-size: .75rem; white-space: nowrap; }
    .actions { display: flex; gap: .35rem; justify-content: flex-end; }
    .empty { color: var(--muted); }
  `,
})
export class ProductList {
  readonly products = input<Product[]>([]);
  readonly busy = input(false);

  readonly refresh = output<void>();
  readonly edit = output<Product>();
  readonly remove = output<Product>();
}
