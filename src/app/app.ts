import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ProductFetch } from './components/product-fetch';
import { ProductForm, SubmitRequest } from './components/product-form';
import { ProductList } from './components/product-list';
import { ResponseInspector } from './components/response-inspector';
import { ApiCall, Product, isProblemDetail } from './product.model';
import { ProductService } from './product.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductFetch, ProductForm, ProductList, ResponseInspector],
  template: `
    <header class="masthead">
      <h1>product-service console</h1>
      <p>
        Every call goes to <code>localhost:4200</code> and is proxied to the Spring app on
        <code>:8081</code>, so there is no CORS in play.
      </p>
    </header>

    <main>
      <div class="column">
        <app-product-list
          [products]="products()"
          [busy]="busy()"
          (refresh)="load()"
          (edit)="startEdit(String($event.id))"
          (remove)="remove(String($event.id))" />

        <app-product-form
          [editing]="editing()"
          [busy]="busy()"
          [serverErrors]="serverErrors()"
          [resetToken]="resetToken()"
          [conflicted]="conflicted()"
          (submitted)="save($event)"
          (reload)="startEdit(String(editing()!.id))"
          (cancel)="clearEdit()" />

        <app-product-fetch [busy]="busy()" (fetch)="fetchOne($event)" (remove)="remove($event)" />
      </div>

      <div class="column">
        <app-response-inspector [call]="service.lastCall()" />
      </div>
    </main>
  `,
  styles: `
    .masthead { margin-bottom: 1.5rem; }
    .masthead h1 { margin: 0 0 .25rem; font-size: 1.25rem; }
    .masthead p { margin: 0; color: var(--muted); font-size: .85rem; }
    main { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 1rem; align-items: start; }
    .column { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
    @media (max-width: 900px) { main { grid-template-columns: 1fr; } }
  `,
})
export class App {
  protected readonly service = inject(ProductService);
  protected readonly String = String;

  protected readonly products = signal<Product[]>([]);
  protected readonly editing = signal<Product | null>(null);
  protected readonly busy = signal(false);

  /**
   * The ETag of the product currently in the form, from the GET that loaded it. This is the
   * concurrency token: without it the PUT would be unconditional and the server would answer
   * 428. It is replaced on every reload and cleared whenever the form is.
   */
  protected readonly editingEtag = signal<string | null>(null);

  /** True after a 412, until the stale copy is reloaded or abandoned. */
  protected readonly conflicted = signal(false);

  /**
   * Bumped after a successful write to clear the form. A plain `editing.set(null)` cannot do
   * it on the create path: editing is already null there, so the signal never changes and
   * the form's effect never re-runs.
   */
  protected readonly resetToken = signal(0);

  /**
   * Only a 400 carries field errors, and only for the call that just failed - so this reads
   * off the last response rather than being stored, and clears itself as soon as the next
   * call succeeds.
   */
  protected readonly serverErrors = computed(() => {
    const call = this.service.lastCall();
    const body = call?.body;

    if (call?.status !== 400 || !isProblemDetail(body)) return null;
    return body.errors ?? null;
  });

  constructor() {
    this.load();
  }

  protected load(options: { silent?: boolean } = {}): void {
    this.run(this.service.list(options), (call) => {
      if (call.status === 200 && Array.isArray(call.body)) {
        this.products.set(call.body as Product[]);
      }
    });
  }

  protected fetchOne(id: string): void {
    this.run(this.service.get(id), (call) => {
      // Loading a single product into the form makes the next PUT replace that row, which is
      // the natural follow-on from having just looked at it - and the GET is also where the
      // ETag that PUT requires comes from.
      if (call.status === 200) this.adoptForEditing(call.body as Product, call.etag);
    });
  }

  /**
   * Edit always re-reads the product rather than using the row already in the table. The
   * table has no ETags - the collection endpoint does not issue them - and without one the
   * PUT cannot be made conditional. It also means the form opens on the current state
   * rather than on whatever the last refresh happened to catch.
   */
  protected startEdit(id: string): void {
    this.fetchOne(id);
  }

  protected clearEdit(): void {
    this.editing.set(null);
    this.editingEtag.set(null);
    this.conflicted.set(false);
  }

  private adoptForEditing(product: Product, etag: string | null): void {
    this.editing.set(product);
    this.editingEtag.set(etag);
    this.conflicted.set(false);
  }

  protected save(submission: SubmitRequest): void {
    const request = submission.id
      ? this.service.update(submission.id, submission.request, this.editingEtag())
      : this.service.create(submission.request);

    this.run(request, (call) => {
      // 412 means the row moved on since the form was loaded. The payload stays on screen -
      // it is the user's work - and the banner offers to reload the server's version.
      if (call.status === 412) {
        this.conflicted.set(true);
        this.load({ silent: true });
        return;
      }

      // 200 for a replace, 201 for a create. Anything else leaves the form as it is so the
      // rejected payload is still on screen next to the error that describes it.
      if (call.status === 200 || call.status === 201) {
        this.clearEdit();
        this.resetToken.update((token) => token + 1);
        // Silent: this refresh must not replace the 201 in the inspector.
        this.load({ silent: true });
      }
    });
  }

  protected remove(id: string): void {
    this.run(this.service.delete(id), (call) => {
      if (call.status === 204) {
        if (this.editing()?.id === Number(id)) this.clearEdit();
        this.load({ silent: true });
      }
    });
  }

  /**
   * Subscribes, flips the busy flag, and hands the completed call to the caller. Errors are
   * already values by the time they get here - see ProductService - so there is no error
   * callback to write.
   */
  private run(request: ReturnType<ProductService['list']>, then: (call: ApiCall) => void): void {
    this.busy.set(true);

    request.subscribe((call) => {
      this.busy.set(false);
      then(call);
    });
  }
}
