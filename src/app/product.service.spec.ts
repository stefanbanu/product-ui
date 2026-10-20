import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProductService } from './product.service';
import { ApiCall } from './product.model';

/**
 * Covers the two mappings a click-through cannot be trusted to reveal: an error status has
 * to arrive as a value rather than as a thrown exception, and a 204 has to produce a null
 * body instead of a parse failure. Everything else about this service is visible in the
 * browser.
 */
describe('ProductService', () => {
  let service: ProductService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ProductService);
    http = TestBed.inject(HttpTestingController);
  });

  it('reports a 404 as a value, with the ProblemDetail body', () => {
    let call: ApiCall | undefined;
    service.get('999999').subscribe((result) => (call = result));

    http.expectOne('/products/999999').flush(
      { title: 'Product not found', status: 404, detail: 'No product with id 999999' },
      { status: 404, statusText: 'Not Found' },
    );

    expect(call?.status).toBe(404);
    expect(call?.body).toMatchObject({ detail: 'No product with id 999999' });
    expect(service.lastCall()?.status).toBe(404);
  });

  it('reports a 204 with a null body and no error', () => {
    let call: ApiCall | undefined;
    service.delete('4').subscribe((result) => (call = result));

    http.expectOne('/products/4').flush(null, { status: 204, statusText: 'No Content' });

    expect(call?.status).toBe(204);
    expect(call?.body).toBeNull();
  });

  it('exposes the Location header a 201 carries', () => {
    let call: ApiCall | undefined;
    service.create({ name: 'Trackball', price: 59.95 }).subscribe((result) => (call = result));

    http.expectOne('/products').flush(
      { id: 11, name: 'Trackball', price: 59.95, createdAt: '2026-10-20T00:00:00Z' },
      { status: 201, statusText: 'Created', headers: { Location: 'http://localhost:4200/products/11' } },
    );

    expect(call?.status).toBe(201);
    expect(call?.location).toBe('http://localhost:4200/products/11');
  });

  it('flags a dead backend as a transport error rather than a status', () => {
    let call: ApiCall | undefined;
    service.list().subscribe((result) => (call = result));

    http.expectOne('/products').error(new ProgressEvent('error'), { status: 0, statusText: '' });

    expect(call?.status).toBe(0);
    expect(call?.transportError).toBeTruthy();
  });
});
