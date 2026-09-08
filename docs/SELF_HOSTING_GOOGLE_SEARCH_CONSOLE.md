# Self-hosted Google Search Console

Connecting Google Search Console (GSC) lets OpenSEO pull your real clicks,
impressions, positions, and URL inspection data, straight from Google.

It's **optional**: OpenSEO runs fine without it, just without Search Console data.

## What you'll need

- A Google account with access to your verified Search Console property.
- ~10 minutes in the [Google Cloud Console](https://console.cloud.google.com/).
- Three environment variables set on your deployment (see [step 4](#4-set-environment-variables)).

## 1) Create a Google Cloud project and enable the API

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create
   a project (or pick an existing one).
2. Enable the
   [Google Search Console API](https://console.cloud.google.com/apis/library/searchconsole.googleapis.com)
   for that project.

## 2) Configure the OAuth consent screen

Under **APIs & Services → OAuth consent screen**:

- Pick **External** (unless everyone using it is in your Google Workspace org).
- Fill in the app name, support email, and developer contact email.
- While the app is in **Testing**, add the Google accounts that will connect as
  **test users** — otherwise Google blocks the sign-in with `access_denied`.

For personal or internal use you don't need to submit for verification; testing
mode is enough.

## 3) Create an OAuth client ID

Under **APIs & Services → Credentials → Create credentials → OAuth client ID**:

1. Application type: **Web application**.
2. Add an **Authorized redirect URI** that exactly matches your deployment's
   origin plus `/api/gsc/oauth/callback`:

   | Deployment   | Redirect URI                                             |
   | ------------ | -------------------------------------------------------- |
   | Deployed     | `https://your-openseo-domain.com/api/gsc/oauth/callback` |
   | Local Docker | `http://localhost:3001/api/gsc/oauth/callback`           |

   The scheme, host, and port must match exactly, with no trailing slash.

3. Save, then copy the **Client ID** and **Client secret**.

## 4) Set environment variables

Set these three values, then restart OpenSEO:

| Variable               | Value                                                                   |
| ---------------------- | ----------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Client ID from step 3.                                                  |
| `GOOGLE_CLIENT_SECRET` | Client secret from step 3.                                              |
| `BETTER_AUTH_SECRET`   | A random string of **at least 32 characters** (encrypts stored tokens). |

`BETTER_AUTH_SECRET` is not needed for normal self-hosting — only for Search
Console, because the stored OAuth tokens are encrypted at rest with it. Generate
one with:

```sh
openssl rand -base64 32
```

Where to set them:

- **Docker self-hosting:** `.env`
- **Cloudflare:** `.env.selfhost`
- **Local development:** `.env.local`

On Cloudflare, do **not** set these in the Workers dashboard. The Alchemy stack
reconciles the worker's vars and secrets on every deploy, so a dashboard-set
value is wiped by the next `pnpm deploy:selfhost`. `.env.selfhost` is the source
of truth; it is gitignored.

## 5) Restart and connect

Restart OpenSEO so it picks up the new variables.

For Docker, changing `.env` means Compose has to recreate the container to
reapply it:

```bash
docker compose up -d --force-recreate open-seo
```

For Cloudflare, redeploy:

```bash
pnpm deploy:selfhost --yes
```

The deploy plan should list the three values as updates, for example
`[open-seo/GOOGLE_CLIENT_SECRET] update`. If they show as `noop`, the env file
was not picked up.

Then open **Integrations**, click **Connect with Google**, authorize the Google
account that owns your verified property, and pick the property to bind to your
project.

## How it works

- OpenSEO uses your Google client to run the OAuth flow and stores the resulting
  grant in its database, with the access and refresh tokens **encrypted at rest**
  (keyed by `BETTER_AUTH_SECRET`).
- Access tokens are minted and refreshed on demand — you only authorize once.
- Search Console data comes from your own Google account, so OpenSEO never meters credits for it.

## Troubleshooting

**`redirect_uri_mismatch` from Google** — the redirect URI in your OAuth client
must exactly equal `<your-origin>/api/gsc/oauth/callback`. Re-check scheme
(`http` vs `https`), host, port, and that there's no trailing slash. Also make
sure it went under **Authorized redirect URIs** and not **Authorized JavaScript
origins** — the latter rejects paths.

If the URI is registered correctly and the error persists, it is propagation
delay on Google's side, not a misconfiguration. The Cloud Console states that
changes take between five minutes and several hours to take effect; retry once
after a wait rather than repeatedly. Google's error page renders this as "this
app doesn't comply with Google's OAuth 2.0 policies", which is the same
condition — the `authError` payload still decodes to `redirect_uri_mismatch`.

**The deploy looked successful but the variables are still missing** (Cloudflare)
— `pnpm alchemy deploy` without `--yes` stops at its approval prompt, prints
`Non-interactive terminal detected. Pass --yes to approve`, and **exits 0**. The
plan is printed, so the output resembles a successful run. Always deploy with
`pnpm deploy:selfhost --yes` and confirm the run ends with `Done: N succeeded`.

**"Google OAuth client not configured" / "not configured for Search Console yet"**
(in the app or via the MCP tools) — one of `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, or `BETTER_AUTH_SECRET` is missing, or the secret is
shorter than 32 characters. Set all three and restart. On Docker, recreate the
container so Compose reapplies `.env`:

```bash
docker compose up -d --force-recreate open-seo
```

**`access_denied` during sign-in** — the Google account isn't listed as a test
user on the OAuth consent screen (while the app is in Testing mode). Add it under
**OAuth consent screen → Test users**.

**Connected, but no properties to pick** — the Google account you authorized
doesn't have a verified property in Search Console. Verify the site in
[Search Console](https://search.google.com/search-console) first, then reconnect.
