# Railway deployment

The repository's `railway.toml` selects `Dockerfile.selfhost` and starts
`docker-entrypoint.sh`. The entrypoint validates configuration, applies local
database migrations, builds using runtime variables, and listens on Railway's
`PORT` on `0.0.0.0`. Railway checks `/api/health` with a ten-minute startup timeout.

## Service settings

- Use the repository root and `/railway.toml` as the service config file. Remove
  old build or pre-deploy command overrides; migrations run in the entrypoint
  where the persistent volume is available.
- Attach a persistent volume at `/app/.wrangler` before storing application data.
  Keep one replica: the container uses local SQLite, KV, and object state.
  Do not mount over `/app`, which contains the application and dependencies.
- Generate a Railway public domain, or configure your custom domain.
- Allow enough memory for the startup build. Node's configured heap ceiling is
  4 GiB; the runtime and other processes need additional memory.

## Variables

Set variables in Railway's **Variables** tab. An `[env]` table in `railway.toml`
does not configure application variables.

For a public deployment using the application's login, configure:

| Variable               | Value                                                         |
| ---------------------- | ------------------------------------------------------------- |
| `AUTH_MODE`            | `hosted`                                                      |
| `BETTER_AUTH_URL`      | Your actual public HTTPS origin, with no placeholder          |
| `BETTER_AUTH_SECRET`   | A stable, randomly generated secret of at least 32 characters |
| `GOOGLE_CLIENT_ID`     | Your Google OAuth client ID                                   |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth client secret                               |
| `DATAFORSEO_API_KEY`   | Base64-encoded DataForSEO `login:password`                    |
| `VITE_SHOW_DEVTOOLS`   | `false`                                                       |

The hosted application's email verification, billing, and optional integrations
may require additional variables from `.env.production.example`. That example
targets Cloudflare/Postgres; do not copy its database settings into this SQLite
container deployment. Keep the auth secret stable across redeploys.

Alternatively, use `AUTH_MODE=cloudflare_access` with `TEAM_DOMAIN` and
`POLICY_AUD` when protected by Cloudflare Access. `AUTH_MODE=local_noauth`
disables authentication and is only suitable behind your own authentication or
on a private network.

The image enables `CLOUDFLARE_INCLUDE_PROCESS_ENV=true` so variables reach the
Workers runtime. Vite allows the exact `RAILWAY_PUBLIC_DOMAIN`, the hostname in
`BETTER_AUTH_URL`, and Railway's healthcheck host. For another custom hostname,
set `ALLOWED_HOST` to that hostname without a URL scheme.

## Verify the deployment

Review deployment logs for preflight errors, migration errors, or an
out-of-memory exit. A successful start serves `/api/health`; then verify login
and an SEO request separately. In hosted mode the health endpoint reports HTTP
availability, not the health of external integrations.

Scheduled rank checks do not run automatically in this container mode; trigger
them from the Rank Tracking page. See [Docker self-hosting](./SELF_HOSTING_DOCKER.md)
for the other container limitations.

This config repairs the existing service's Config as Code deployment. Railway
documents a December 1, 2026 cutoff for legacy configuration files; migrate the
service to Infrastructure as Code before then. See Railway's
[configuration reference](https://docs.railway.com/config-as-code/reference) and
[healthcheck documentation](https://docs.railway.com/deployments/healthchecks).
