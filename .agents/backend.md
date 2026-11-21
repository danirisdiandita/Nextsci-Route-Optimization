# Backend layout

The Django backend is split into one app per business domain under `backend/apps/`. Every app has the same internal layout, and dependencies point in one direction. These rules keep the backend easy to navigate as it grows from one app to a dozen. `scripts/check.sh` runs `lint-imports`, which enforces the numbered rules with the contracts in `backend/.importlinter`.

## Folders

```text
backend/
├── config/                 Project wiring only: settings, root URLs, ASGI and WSGI
│   ├── settings/           base.py (shared), dev.py (default), prod.py
│   └── urls.py             Mounts each app's api/urls.py under /api/v1/<app>/
├── apps/
│   └── <domain>/           One Django app per business domain
│       ├── models.py       Tables. Split into a models/ package when the file passes about 300 lines
│       ├── services.py     Writes: create, update, delete, and the business rules around them
│       ├── selectors.py    Reads: query functions that return querysets or plain values
│       ├── api/            The HTTP boundary
│       │   ├── serializers.py
│       │   ├── views.py
│       │   └── urls.py
│       ├── admin.py
│       ├── apps.py         name = "apps.<domain>", label = "<domain>"
│       ├── migrations/
│       └── tests/          test_api.py, test_services.py, test_selectors.py
├── app_template/           Template that scripts/new-backend-app.sh renders
├── .importlinter           Import contracts
├── requirements.txt        Runtime dependencies (Docker installs only these)
└── requirements-dev.txt    Runtime dependencies plus development tools
```

## Create an app

Run the generator from the repository root. Do not run `startapp` by hand.

```bash
scripts/new-backend-app.sh fleet
```

The generator creates `backend/apps/fleet/` in the layout above. It adds the app to `INSTALLED_APPS` and mounts its URLs at `/api/v1/fleet/`. It refuses to overwrite an existing app.

## Rules

1. **Dependencies inside an app point down.** `api` may import `services`, `selectors`, and `models`. `services` and `selectors` may import `models`. `models` imports none of them.
2. **Only `config` and other `api` packages import an app's `api`.** Models, services, selectors, and admin never import any app's `api`.
3. **Apps depend only on apps below them in the domain order.** See the domain map below. An app may import the models, services, and selectors of a lower app. It never imports from a higher app. When a lower app must react to a higher one, use a Django signal or pass a callback in.

These rules need judgment, so no script checks them:

- **Views stay thin.** A view parses the request, calls one service or selector, and serializes the result. Business rules live in `services.py`, so the admin, management commands, and other apps can call them too.
- **Services take keyword-only arguments** and return model instances. Wrap a multi-step write in `transaction.atomic()`.
- **Selectors own query shape.** Put `select_related`, `prefetch_related`, and filtering in a selector. Views never build querysets.
- **Validate at the boundary.** Serializers validate request data. Services trust their arguments and enforce business rules, not types.
- **Test through the public surface.** Test endpoints in `tests/test_api.py` with the DRF `APIClient`. Test business rules by calling services directly.
- **Create a shared app only when two apps need the same code.** Do not create `common/` or `utils/` in advance.

## Domain map

`accounts` exists today. The other apps are planned. Create each one with the generator when its first feature starts, not before. The list is in dependency order: each app may depend on the apps below it.

| Order | App | Owns |
| --- | --- | --- |
| 6 | `notifications` | Customer messages by email and SMS, and their templates |
| 5 | `tracking` | Driver location updates, stop status events, and proof of delivery |
| 4 | `routing` | Route plans, routes, the stops on each route in order, and solver runs |
| 3 | `orders` | Customers, orders, stops, time windows, service times, and order imports |
| 2 | `fleet` | Depots, vehicles and their capacity, drivers, shifts, breaks, and skills |
| 1 | `accounts` | Users, sign-in, and JWT tokens |

The `domain-order` contract in `backend/.importlinter` lists the same order. If a new feature needs a different order, change the table and the contract in the same commit.

## The route solver

Keep the optimization code in a plain Python package, `backend/engine/`, that never imports Django. The `routing` app turns models into the engine's input types, calls the engine, and saves the result. This keeps the solver fast to test and possible to replace. When you create `backend/engine/`, add it to `root_packages` in `backend/.importlinter`, and add a `forbidden` contract that stops it from importing `django`, `rest_framework`, and `apps`.
