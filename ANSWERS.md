# Written Answers

## 5.1 Performance & Security

### 1. Making `GET /api/tasks` fast with 1,000,000+ tasks

1. **Always paginate on the server.** Already done (`per_page` capped at 100). For deep pages switch to
   **cursor pagination** (`cursorPaginate()`, `WHERE id < ? ORDER BY id DESC LIMIT n`): `OFFSET 500000` still scans
   and discards 500k rows, a cursor seeks directly through the primary key.
2. **Avoid `COUNT(*)` on every request.** `paginate()` runs a count over the filtered set. Use `simplePaginate()`/cursor
   pagination for infinite scroll, or cache the totals per filter for a short TTL.
3. **Indexes that match the real queries.** The common query is
   `WHERE deleted_at IS NULL AND assigned_to = ? [AND status = ?] ORDER BY id DESC`. The composite index
   `(assigned_to, status)` already serves the filter; extending it to `(assigned_to, status, id)` lets MySQL also
   satisfy the sort from the index. Verify with `EXPLAIN` and the slow query log instead of guessing.
4. **Title search.** `LIKE '%term%'` cannot use a B-tree index and becomes a full scan. Use a MySQL `FULLTEXT` index
   (`whereFullText`) or an external engine (Meilisearch/OpenSearch through Laravel Scout) for real search.
5. **No N+1, small payloads.** The assignee is eager-loaded (`with('assignee')`): 2 queries per page instead of
   1 + N. Select only the columns the list needs and keep `description` out of list responses if it grows large.
6. **Caching.** Cache hot, rarely changing reads (user list for the assignee dropdown, counts per status) in Redis
   and invalidate on task writes via model events; add `ETag`/`Cache-Control` so clients can revalidate cheaply.
7. **Scale the data and the runtime.** Archive or partition old `done` tasks, route reads to a MySQL read replica,
   and run PHP with OPcache (+ JIT/Octane if CPU-bound).

### 2. Securing the Laravel + SPA setup

| Threat | Mitigation |
|--------|------------|
| Credential stuffing / brute force | `throttle:5,1` on `/api/login`; generic "credentials do not match" message (no user enumeration). |
| Auth token / session leakage | **Implemented:** Sanctum SPA mode — no token is ever exposed to JavaScript; the session cookie is `httpOnly` + `SameSite=Lax` (+ `Secure` in production), the session id is regenerated on login (session fixation) and invalidated on logout, sessions expire server-side. HTTPS only (HSTS); never put credentials in URLs or logs. A Bearer token in `localStorage` was rejected because any XSS could read and exfiltrate it. |
| Broken access control / IDOR (`/api/tasks/{id}` of another user) | Policies on every single-resource action, plus query scoping (`visibleTo`) on lists; covered by feature tests (403 / empty list). |
| Mass assignment / privilege escalation | `$fillable` whitelists, controllers only use `$request->validated()`, `role` is never mass-assignable, non-admins cannot set `assigned_to` to someone else. |
| SQL injection | Eloquent / query builder parameter binding everywhere, no string-concatenated SQL; `LIKE` wildcards in user input are escaped. |
| XSS | httpOnly cookies stop session theft, but injected script could still act as the user inside the page, so XSS itself must be prevented: the API only returns `application/json` (never rendered as HTML); Vue escapes `{{ }}` and bound attributes by default, so never use `v-html` with user data (or sanitize with DOMPurify if rich text is ever needed); no `eval`/runtime template compilation; a strict Content-Security-Policy (`script-src 'self'`, no inline scripts) on the SPA host; `npm audit` for vulnerable packages. |
| CSRF | Cookies are sent automatically, so CSRF protection is required and enforced: `/sanctum/csrf-cookie` issues `XSRF-TOKEN`, writes must echo it in `X-XSRF-TOKEN` (otherwise 419); `SameSite=Lax` blocks cross-site POSTs; only `SANCTUM_STATEFUL_DOMAINS` get session auth. |
| Cross-origin abuse | CORS restricted to the SPA origin (`CORS_ALLOWED_ORIGINS`), not `*`. |
| Information disclosure | `APP_DEBUG=false` in production (debug mode returns stack traces); API Resources expose an explicit field list (no password/remember_token). |
| Vulnerable dependencies & secrets | `composer audit` / `npm audit` in CI; secrets only in `.env` / the secret store, never committed. Note: Laravel 11 currently has unpatched advisories (see README) — upgrading to Laravel 12+ is the real fix. |

## 5.2 TypeScript / Vue 3

To be answered together with the frontend part.

## 6.1 Apache 2.4 & deployment (bonus)

Two virtual hosts on sub-domains of the same site (`tasks.example.com` + `api.tasks.example.com`): Sanctum's cookie
auth needs the SPA and API to be same-site, with `SESSION_DOMAIN=.tasks.example.com`, `SESSION_SECURE_COOKIE=true`
and `SANCTUM_STATEFUL_DOMAINS=tasks.example.com`.

```apache
# API — Laravel. DocumentRoot must be public/ so .env, vendor/ and storage/ are never web-accessible.
<VirtualHost *:443>
    ServerName api.tasks.example.com
    DocumentRoot /var/www/backend/public

    <Directory /var/www/backend/public>
        AllowOverride None
        Require all granted
        # Same effect as Laravel's public/.htaccess: real files are served, everything else goes to the front controller.
        FallbackResource /index.php
    </Directory>

    # SSLEngine on, SSLCertificateFile …, SSLCertificateKeyFile …
</VirtualHost>

# SPA — static build output of `npm run build`.
<VirtualHost *:443>
    ServerName tasks.example.com
    DocumentRoot /var/www/frontend/dist

    <Directory /var/www/frontend/dist>
        AllowOverride None
        Require all granted
        # History-mode routing: /tasks/123 is not a file, so serve index.html and let Vue Router resolve it.
        FallbackResource /index.html
    </Directory>

    # Hashed assets can be cached forever; index.html must always be revalidated to pick up new deployments.
    <FilesMatch "\.(js|css|woff2?|svg|png)$">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </FilesMatch>
    <Files "index.html">
        Header set Cache-Control "no-cache"
    </Files>
</VirtualHost>
```

- Modules: `ssl`, `headers` (Cache-Control rules); `rewrite` only if using the alternative below.
- `mod_rewrite` alternative to `FallbackResource` (what Laravel's `public/.htaccess` does):
  `RewriteCond %{REQUEST_FILENAME} !-f` + `RewriteCond %{REQUEST_FILENAME} !-d` + `RewriteRule ^ index.php [L]`
  (`index.html` for the SPA).
- Same-domain alternative: serve the SPA at `/` and proxy `/api` to the Laravel vhost/container (`ProxyPass /api …`),
  which removes CORS entirely.
- Run `php artisan config:cache route:cache view:cache` and `composer install --no-dev --optimize-autoloader` on deploy.

## 6.2 Docker / CI/CD (bonus)

**Docker** — already used for local development (`docker-compose.yml`):

- `app`: `php:8.3-apache` with `pdo_mysql`, `zip`, `bcmath`, `mod_rewrite`, DocumentRoot `public/`.
- `db`: `mysql:8.0` with a named volume and a health check; `app` starts only once the DB is healthy.

For production, a multi-stage image: stage 1 `composer install --no-dev`, stage 2 `node` builds the SPA,
final stage copies only the runtime artifacts into `php:8.3-apache`, runs as a non-root user, and gets config
from environment variables / secrets (never a baked-in `.env`).

**CI pipeline** (e.g. GitHub Actions / GitLab CI), on every PR:

1. Backend: setup PHP 8.3 → `composer install` → `pint --test` → `php artisan test` (MySQL service container for
   parity) → `composer audit`.
2. Frontend: `npm ci` → `eslint` → `vue-tsc --noEmit` (type check) → unit tests → `npm run build` → `npm audit`.
3. On merge to `main`: build and push the Docker image tagged with the commit SHA.
4. Deploy: pull the image, `php artisan migrate --force`, cache config/routes, switch traffic, run a smoke test
   (`GET /up`, login), roll back to the previous tag if it fails.
