# Team Task Manager

Small internal task manager.

| Layer    | Stack                                        |
|----------|----------------------------------------------|
| Backend  | Laravel 11, PHP 8.3, MySQL 8, Apache 2.4     |
| Frontend | Vue 3, Vuetify 3, TypeScript, Tailwind CSS 4, TanStack Vue Query, Pinia, Vue Router, axios (`frontend/`) |
| Auth     | Laravel Sanctum SPA authentication (httpOnly session cookie + CSRF) |

Written answers (performance, security, deployment) are in [ANSWERS.md](ANSWERS.md).

---

## 1. Run the backend

Requirements: Docker (Desktop) with Compose v2. Local PHP is **not** required.

```bash
cp backend/.env.example backend/.env
docker compose up -d --build
docker compose exec app composer install
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --seed
```

- API base URL: `http://localhost:8000/api`
- MySQL is exposed on `localhost:3307` (user `task` / password `secret`, database `task_manager`).
- DB credentials are injected by `docker-compose.yml`, so they override whatever is in `.env`.
- `backend/vendor` lives in a named Docker volume (`vendor`), not in the bind mount: on Docker Desktop
  (Windows/macOS) each file access through a bind mount is ~50× slower, which made every Laravel request take
  several seconds. Application code is still bind-mounted, so edits are picked up immediately. Run
  `docker compose exec app composer install` after changing dependencies; a local `composer install` only
  feeds your IDE.

### Seeded accounts

All passwords are `password`.

| Email               | Role  | Seeded tasks |
|---------------------|-------|--------------|
| `admin@example.com` | admin | 20           |
| `user1@example.com` | user  | 20           |
| `user2@example.com` | user  | 20           |

### Tests and code style

```bash
docker compose exec app php artisan test        # Feature tests, in-memory SQLite
docker compose exec app ./vendor/bin/pint --test # Code style
```

---

## 2. Run the frontend

Requirements: Node.js `^22.18` or `>=24.12` (see `frontend/package.json` → `engines`), the backend from step 1 running.

```bash
cd frontend
cp .env.example .env.local   # VITE_API_URL=http://localhost:8000
npm ci
npm run dev                  # http://localhost:5173
```

> Open the app at **`http://localhost:5173`**, not `127.0.0.1:5173`: the session cookie is only sent when the SPA
> and the API (`localhost:8000`) are on the same site.

| Script | What it does |
|--------|--------------|
| `npm run dev` | Vite dev server (pinned to `localhost:5173`) |
| `npm run build` | `vue-tsc` type check + production build into `dist/` |
| `npm run test:unit` | Vitest (`npx vitest run` for a single run) |
| `npm run lint` | oxlint + ESLint |
| `npm run format` | Prettier |

### Pages

| Route | Access | What it shows |
|-------|--------|---------------|
| `/login` | guests only | Split-screen sign-in; server errors under the fields; one-click demo accounts in dev builds |
| `/tasks` | logged in | Status summary cards (click to filter), search / status / assignee (admin) filters, server-side paginated `v-data-table-server`, status chips, overdue badges, create dialog, delete with confirmation, stacked rows on mobile |
| `/tasks/:id` | logged in | Edit form (same `TaskForm`) next to a details panel; delete; dedicated 403/404 states |

Filters and pagination are mirrored in the URL (`/tasks?status=done&search=api&page=2`), so reloads and shared
links keep the same view.

### UI and state

| Concern | Library | Role |
|---------|---------|------|
| Components | Vuetify 3 | Inputs, data table, dialogs, date picker, theme (indigo/slate palette, Inter font) |
| Layout / spacing | Tailwind CSS v4 | Utility classes for layout and custom blocks (cards, login panel, empty states) |
| Server state | TanStack Vue Query | Caching, background refetch, request cancellation, cache invalidation after mutations |
| Client state | Pinia | Current user (`auth`) and snackbar (`notify`) |

- Tailwind runs without its preflight reset, and Vuetify's base stylesheet is imported into a lower cascade layer
  (`theme, base, vuetify, components, utilities`), so Tailwind spacing utilities are not cancelled by Vuetify's
  global `* { margin: 0; padding: 0 }` reset.
- Query keys: `['tasks', 'list', filters]`, `['tasks', 'stats', assignee]`, `['tasks', 'detail', id]`, `['users']`.
  Creating, updating or deleting a task updates the detail cache and invalidates lists and stats; switching pages
  keeps the previous page on screen until the next one arrives (`keepPreviousData`).
- The whole query cache is cleared on login, logout and on a `401`, so one user never sees another user's cached
  tasks.

### Structure

```
frontend/src
├─ api/          axios instance (credentials, XSRF, 419 retry, 401 handling) + one module per resource
├─ queries/      TanStack Query hooks and query keys for tasks and users
├─ types/        API types mirroring the Laravel resources
├─ stores/       Pinia: auth (current user), notify (snackbar)
├─ router/       routes + auth guard (pure function, unit tested)
├─ composables/  useAssignees (admin: GET /api/users, user: only themselves)
├─ components/   TaskForm (create + edit), TaskStatusChip, UserAvatar, AppLogo, ConfirmDialog
├─ plugins/      Vuetify theme/defaults, TanStack QueryClient defaults
├─ assets/       main.css: Tailwind + cascade layers + Vuetify overrides
└─ views/        LoginView, TasksView, TaskDetailView
```

### Auth flow in the SPA

- `stores/auth.ts` keeps only the current user in memory — no token is stored anywhere in the browser.
- On load the router guard calls `GET /api/me` once to restore the session from the httpOnly cookie.
- `login()` calls `GET /sanctum/csrf-cookie`, then `POST /api/login`; axios sends cookies (`withCredentials`) and
  copies `XSRF-TOKEN` into `X-XSRF-TOKEN` (`withXSRFToken`).
- A `419` (expired CSRF token) refreshes the cookie and retries the request once; a `401` clears the user and
  redirects to `/login?redirect=…` (only internal paths are accepted, to avoid an open redirect).
- A regular user can only assign tasks to themselves, so the assignee select is read-only for them and
  `GET /api/users` (admin-only) is never called.

---

## 3. API

### Authentication flow (Sanctum SPA mode)

The SPA never sees a token. Laravel keeps the login in a server-side session whose cookie is `httpOnly`,
so JavaScript (and therefore an XSS payload) cannot read or exfiltrate it.

1. `GET /sanctum/csrf-cookie` → sets the `XSRF-TOKEN` cookie (readable by JS by design).
2. `POST /api/login` with header `X-XSRF-TOKEN: <cookie value>` → sets the httpOnly session cookie.
3. Every following request sends the cookies (`withCredentials: true`) and, for writes, `X-XSRF-TOKEN`.

Requirements:

- The request must come from a stateful domain (`Origin`/`Referer` in `SANCTUM_STATEFUL_DOMAINS`, default includes
  `localhost:5173`); other origins get no session (login → 400, API → 401).
- SPA and API must be on the same site: use `localhost` for both locally (not a mix of `localhost` and `127.0.0.1`);
  in production use sub-domains of one domain and set `SESSION_DOMAIN=.your-domain` + `SESSION_SECURE_COOKIE=true`.

Trying it with curl:

```bash
O='Origin: http://localhost:5173'; J=cookies.txt
curl -s -c $J -H "$O" http://localhost:8000/sanctum/csrf-cookie
X=$(grep XSRF-TOKEN $J | awk '{print $7}' | sed 's/%3D/=/g')
curl -s -b $J -c $J -H "$O" -H "X-XSRF-TOKEN: $X" -H 'Accept: application/json' \
     -X POST http://localhost:8000/api/login -d email=admin@example.com -d password=password
curl -s -b $J -H "$O" -H 'Accept: application/json' http://localhost:8000/api/tasks
```

Send `Accept: application/json` (errors are JSON for all `/api/*` routes regardless).

| Method | Path               | Who            | Success |
|--------|--------------------|----------------|---------|
| GET    | `/sanctum/csrf-cookie` | public     | 204 |
| POST   | `/api/login`       | public (5 req/min) | 200 `{ data: user }` |
| POST   | `/api/logout`      | authenticated  | 204 (session invalidated) |
| GET    | `/api/me`          | authenticated  | 200 |
| GET    | `/api/tasks`       | authenticated  | 200 (paginated) |
| POST   | `/api/tasks`       | authenticated  | 201 |
| GET    | `/api/tasks/{id}`  | owner / admin  | 200 |
| PUT    | `/api/tasks/{id}`  | owner / admin  | 200 |
| DELETE | `/api/tasks/{id}`  | owner / admin  | 204 |
| GET    | `/api/users`       | admin          | 200 |
| POST   | `/api/users`       | admin          | 201 |

### `GET /api/tasks` query parameters

| Param         | Type                              | Notes |
|---------------|-----------------------------------|-------|
| `status`      | `todo` \| `in_progress` \| `done` | optional |
| `assigned_to` | user id                           | optional; for a non-admin it is combined with "own tasks only" |
| `search`      | string ≤ 100                      | case-insensitive substring match on `title`; `%`/`_` are matched literally |
| `page`        | int ≥ 1                           | default 1 |
| `per_page`    | int 1–100                         | default 15 |

Response (Laravel paginated resource):

```json
{
  "data": [{
    "id": 1, "title": "…", "description": null, "status": "todo",
    "assigned_to": 2,
    "assignee": { "id": 2, "name": "User One", "email": "user1@example.com", "role": "user" },
    "due_date": "2026-12-01",
    "created_at": "2026-11-07T08:43:26+00:00", "updated_at": "2026-11-07T08:43:26+00:00"
  }],
  "links": { "first": "…", "last": "…", "prev": null, "next": "…" },
  "meta": { "current_page": 1, "last_page": 4, "per_page": 15, "total": 60 }
}
```

### Task payload (`POST` / `PUT`)

| Field         | Rules |
|---------------|-------|
| `title`       | required on create, string ≤ 255 |
| `description` | nullable string ≤ 5000 |
| `status`      | `todo` \| `in_progress` \| `done`, defaults to `todo` |
| `assigned_to` | existing user id; defaults to the caller on create; a non-admin may only use their own id |
| `due_date`    | nullable, `YYYY-MM-DD` |

`PUT` accepts partial payloads: only the fields sent are validated and updated.

### Errors

| Status | When | Body |
|--------|------|------|
| 400 | login from a non-SPA origin | `{ "message": "Login is only available to the SPA (stateful domain)." }` |
| 401 | not logged in / session expired | `{ "message": "Unauthenticated." }` |
| 419 | missing or invalid `X-XSRF-TOKEN` | `{ "message": "CSRF token mismatch." }` |
| 403 | policy denies the action | `{ "message": "This action is unauthorized." }` |
| 404 | unknown or soft-deleted resource | `{ "message": "Resource not found." }` |
| 422 | validation failed | `{ "message": "…", "errors": { "field": ["…"] } }` |
| 429 | login rate limit hit | `{ "message": "Too Many Attempts." }` |

With `APP_DEBUG=true` (local default) error bodies also include a stack trace; production must run with `APP_DEBUG=false`.

---

## 4. Authorization rules

| Action                          | admin | user |
|---------------------------------|-------|------|
| List tasks                      | all   | only tasks assigned to them |
| View / update / delete a task   | any   | only tasks assigned to them |
| Create a task                   | for anyone | only for themselves |
| List / create users             | yes   | no |

Implemented with `TaskPolicy` / `UserPolicy` (admin short-circuits in `TaskPolicy::before`) plus the
`Task::visibleTo()` query scope, so the list endpoint never loads other users' rows.

---

## 5. Assumptions and decisions

- **"Own task" = task where `assigned_to` is the user.** The spec has no `created_by` column, so ownership follows the assignee.
- **Soft delete** for tasks (`deleted_at`). Deleted tasks disappear from all endpoints (404) but stay recoverable in the database.
- **Deleting a user who still has tasks is blocked** (`ON DELETE RESTRICT`) instead of cascading and silently losing tasks.
- **`role` is not mass-assignable**; it is set explicitly so a request payload cannot escalate privileges.
- **Cookie-based SPA auth instead of Bearer tokens**: a token kept in `localStorage` can be stolen by any XSS; the
  session cookie is `httpOnly` + `SameSite=Lax`, CSRF is enforced, the session id is regenerated on login and
  invalidated on logout. Sessions live in the `sessions` table and expire after `SESSION_LIFETIME` (120 min).
- **CORS** only allows `CORS_ALLOWED_ORIGINS` (default `http://localhost:5173`, the Vite dev server) and allows credentials.
- **`GET /api/users` is admin-only.** A regular user can only assign tasks to themselves, so the frontend uses `/api/me` for their assignee option.
- **Tests run on in-memory SQLite** for speed; the app itself runs on MySQL 8. The schema and seed were verified on MySQL via `migrate:fresh --seed`.

### Known issue: Laravel 11 security advisories

`composer audit` reports advisories on `laravel/framework` that are fixed only in Laravel 12.60+/13.x; the exercise
mandates Laravel 11. Mitigations in this codebase:

- *CRLF injection in the `email` rule*: every `email` field also has `not_regex:/[\r\n]/` (covered by a test).
- *TokenGuard non-string credentials*: the built-in `token` guard is not used; authentication goes through Sanctum.
- *Debug page XSS*: production runs with `APP_DEBUG=false`.
- *Temporary signed URL path confusion*: signed URLs are not used.
