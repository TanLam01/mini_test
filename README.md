# Team Task Manager

Small internal task manager.

| Layer    | Stack                                        |
|----------|----------------------------------------------|
| Backend  | Laravel 11, PHP 8.3, MySQL 8, Apache 2.4     |
| Frontend | Vue 3 + Vuetify 3 + TypeScript (`frontend/`, in progress) |
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

## 2. API

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

## 3. Authorization rules

| Action                          | admin | user |
|---------------------------------|-------|------|
| List tasks                      | all   | only tasks assigned to them |
| View / update / delete a task   | any   | only tasks assigned to them |
| Create a task                   | for anyone | only for themselves |
| List / create users             | yes   | no |

Implemented with `TaskPolicy` / `UserPolicy` (admin short-circuits in `TaskPolicy::before`) plus the
`Task::visibleTo()` query scope, so the list endpoint never loads other users' rows.

---

## 4. Assumptions and decisions

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
