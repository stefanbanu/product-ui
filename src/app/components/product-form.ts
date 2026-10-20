import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Product, ProductRequest } from '../product.model';

export interface SubmitRequest {
  /** null means create (POST); an id means replace (PUT). */
  id: string | null;
  request: ProductRequest;
}

/**
 * One form for both POST and PUT, mirroring the backend: ProductRequest is shared between
 * create and update there too, so the fields and their rules are identical.
 *
 * The validators intentionally duplicate the Bean Validation constraints on ProductRequest
 * (name @NotBlank @Size(max=255); price @NotNull @Positive @Digits(17,2)). That duplication
 * is the feature - it lets you see the client reject a payload, then tick "send anyway" and
 * watch the server reject the same payload with its own 400 and errors map.
 */
@Component({
  selector: 'app-product-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <section class="panel">
      <header>
        <h2>{{ editing() ? 'PUT /products/' + editing()!.id : 'POST /products' }}</h2>
        @if (editing()) {
          <button type="button" (click)="cancel.emit()">New instead</button>
        }
      </header>

      @if (conflicted()) {
        <p class="conflict">
          Someone else changed this product after you loaded it, so your copy is stale and
          the server refused the write. Reload it to see their version, then reapply your
          change.
          <button type="button" (click)="reload.emit()">Reload</button>
        </p>
      }

      <form [formGroup]="form" (ngSubmit)="submit()">
        <label>
          <span>name</span>
          <input formControlName="name" placeholder="Mechanical Keyboard" />
          @if (control('name').touched && control('name').errors; as errors) {
            <small class="error">
              @if (errors['required']) { must not be blank }
              @else if (errors['maxlength']) { at most 255 characters }
              @else if (errors['server']) { server: {{ errors['server'] }} }
            </small>
          }
        </label>

        <label>
          <span>price</span>
          <!-- Text, not type=number: a number input silently refuses to hand over a value it
               considers invalid, which would make it impossible to send "1.234" or "abc" and
               see how the API answers. -->
          <input formControlName="price" placeholder="129.99" inputmode="decimal" />
          @if (control('price').touched && control('price').errors; as errors) {
            <small class="error">
              @if (errors['required']) { must not be null }
              @else if (errors['pattern']) { up to 17 digits and 2 decimals, e.g. 129.99 }
              @else if (errors['server']) { server: {{ errors['server'] }} }
            </small>
          }
        </label>

        <label class="inline">
          <input type="checkbox" [checked]="bypass()" (change)="bypass.set(!bypass())" />
          <span>send anyway (skip client validation, to exercise the server's 400)</span>
        </label>

        <button type="submit" [disabled]="busy() || (form.invalid && !bypass())">
          {{ editing() ? 'Replace' : 'Create' }}
        </button>
      </form>
    </section>
  `,
  styles: `
    header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    form { display: flex; flex-direction: column; gap: .75rem; }
    label { display: flex; flex-direction: column; gap: .25rem; }
    label > span { color: var(--muted); font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; }
    label.inline { flex-direction: row; align-items: center; gap: .5rem; }
    label.inline > span { text-transform: none; letter-spacing: 0; font-size: .8rem; }
    input[type='text'], input:not([type]) { padding: .4rem .5rem; border: 1px solid var(--border);
      border-radius: 4px; background: var(--input-bg); color: inherit; font: inherit; }
    .error { color: #b45309; font-size: .8rem; }
    .conflict { border: 1px solid #b45309; border-radius: 6px; padding: .6rem .75rem;
      margin: 0 0 .75rem; font-size: .85rem; line-height: 1.45; }
    .conflict button { margin-left: .4rem; }
    button[type='submit'] { align-self: flex-start; }
  `,
})
export class ProductForm {
  readonly editing = input<Product | null>(null);
  readonly busy = input(false);
  /** The errors map from a 400, keyed by field name, applied onto the matching control. */
  readonly serverErrors = input<Record<string, string> | null>(null);
  /** Changes to this value clear the form; see the field of the same name on App. */
  readonly resetToken = input(0);

  /** Set after a 412: the row moved on, so the form is holding a stale snapshot. */
  readonly conflicted = input(false);

  readonly submitted = output<SubmitRequest>();
  readonly cancel = output<void>();
  readonly reload = output<void>();

  protected readonly bypass = signal(false);

  private readonly builder = new FormBuilder();

  protected readonly form = this.builder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    price: ['', [Validators.required, Validators.pattern(/^\d{1,17}(\.\d{1,2})?$/)]],
  });

  constructor() {
    effect(() => {
      const product = this.editing();
      this.resetToken();

      if (product) {
        this.form.setValue({ name: product.name, price: String(product.price) });
      } else {
        this.form.reset({ name: '', price: '' });
      }
    });

    effect(() => {
      const errors = this.serverErrors();

      if (!errors) return;

      for (const [field, message] of Object.entries(errors)) {
        const control = this.form.get(field);
        // Mark touched too, or the message never shows: the template only renders errors for
        // touched controls, and a server rejection can arrive on a pristine field.
        control?.setErrors({ ...(control.errors ?? {}), server: message });
        control?.markAsTouched();
      }
    });
  }

  protected control(name: 'name' | 'price') {
    return this.form.controls[name];
  }

  protected submit(): void {
    if (this.form.invalid && !this.bypass()) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, price } = this.form.getRawValue();
    const editing = this.editing();

    this.submitted.emit({
      id: editing ? String(editing.id) : null,
      // An unparseable price becomes null rather than NaN, which JSON.stringify would turn
      // into null anyway - this way the intent is explicit and the server sees "must not be
      // null" instead of a silently mangled payload.
      request: { name, price: price.trim() === '' || isNaN(Number(price)) ? null! : Number(price) },
    });
  }
}
