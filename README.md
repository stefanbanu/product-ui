# product-ui

A browser console for exercising the [product-service](https://github.com/stefanbanu/product-service)
REST API. It is a test tool, not a product catalogue: alongside the usual CRUD it shows the
**status code, duration, `Location` header and response body** of the last call, because the
behaviours worth checking — `201` vs `200` vs `204`, the `Location` header, the RFC 7807
error bodies — are exactly what a normal CRUD screen hides.

![endpoints](https://img.shields.io/badge/endpoints-5-informational)
Angular 21 · zoneless · signals · no UI library

## Requirements

- Node 24+ and npm
- The `product-service` Spring Boot app running on port **8081**

This app is useless on its own — every panel talks to that API.

## Running it

Two terminals:

```bash
# 1. the API
cd ../product-service
./mvnw spring-boot:run          # :8081

# 2. this UI
npm install                     # first time only
npm start                       # :4200
```

Then open **http://localhost:4200**.

The API uses an in-memory H2 database that is recreated on every boot, so restarting it
discards whatever you created and restores the ten seeded products.

## What you can do

| Panel | Exercises |
|---|---|
| **Products** table — Refresh | `GET /products` |
| **Products** table — Edit / Delete per row | `PUT /products/{id}` · `DELETE /products/{id}` |
| **POST / PUT** form | `POST /products` · `PUT /products/{id}` |
| **/products/:id** panel | `GET /products/{id}` · `DELETE /products/{id}` with any id |
| **Last response** | status, duration, `Location`, field errors, body |

A few things are deliberate:

- **"send anyway"** on the form bypasses client-side validation. The form's rules duplicate
  the server's Bean Validation constraints, so without this toggle the server's own `400`
  would be unreachable from the UI. Tick it, blank the name, enter `-1`, and the response
  panel shows the `errors` map — which is also applied back onto the offending fields.
- **The `/products/:id` panel** takes an arbitrary id, including ones that do not exist. The
  table can only ever offer valid ids, so this is the only way to reach `404`
  (`999999`) and the `400` Spring returns for an unbindable id (`abc`).
- **The refresh after a create or delete is silent.** It updates the table but does not
  touch the inspector, or it would overwrite the `201` and its `Location` the instant they
  appeared.

## No CORS, by design

`proxy.conf.json` forwards `/products` from the dev server to `:8081`, so the browser only
ever talks to its own origin and CORS never comes into it. The Spring app carries **no CORS
configuration** as a result, which is how it should stay — that would be dev-only permission
shipping in production code.

This is why every URL in `product.service.ts` is relative. Hardcoding
`http://localhost:8081` anywhere would route around the proxy and reintroduce the problem.

## Layout

```
src/app/
  product.model.ts            Product, ProductRequest, ProblemDetail, ApiCall
  product.service.ts          one method per endpoint; the whole exchange, not just the body
  product.service.spec.ts     error-as-value and 204-as-null mappings
  app.ts                      composes the panels, owns the product list and edit target
  components/
    product-list.ts           the table
    product-form.ts           create/replace, with the validation toggle
    product-fetch.ts          arbitrary-id GET and DELETE
    response-inspector.ts     the last exchange
```

The one thing to know before editing: every request uses `observe: 'response'`. With
HttpClient's default the status code and headers are discarded before the app sees them,
which would make most of this console impossible.

Change detection is **zoneless**, so component state must live in signals — a plain mutable
field updated from an HTTP callback will not re-render.

## Commands

```bash
npm start        # dev server on :4200, proxying to :8081
npm test         # vitest
npm run build    # production bundle into dist/
```
