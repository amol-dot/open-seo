# Self-hosted Google Analytics

Connecting Google Analytics lets OpenSEO bind a GA4 property to a project. The
connection is optional and read-only.

## What you'll need

- A Google account with access to the GA4 property.
- A Google Cloud project with OAuth credentials.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `BETTER_AUTH_SECRET` set on
  the OpenSEO deployment.

If Search Console is already connected, reuse the same Google Cloud project and
OAuth client. GA4 still asks for a separate consent grant.

## 1) Enable the Analytics APIs

In the [Google Cloud Console](https://console.cloud.google.com/), enable both:

- [Google Analytics Admin API](https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com)
- [Google Analytics Data API](https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com)

The Admin API lists properties during connection. The Data API powers the
read-only reports added in later GA4 milestones.

## 2) Configure the OAuth consent screen

Under **APIs & Services → OAuth consent screen**, configure the app. While the
app is in Testing, add every Google account that will connect as a test user.

If the consent screen's user type is **Internal** (a Google Workspace org), the
test-user list does not apply and no verification is needed — but only accounts
in that org can connect. If the account holding the GA4 property is outside the
org, switch the user type to **External**.

## 3) Register the callback URL

Open **APIs & Services → Credentials**, edit the Web application OAuth client,
and add an authorized redirect URI matching the deployment origin plus
`/api/ga4/oauth/callback`.

| Deployment   | Redirect URI                                             |
| ------------ | -------------------------------------------------------- |
| Deployed     | `https://your-openseo-domain.com/api/ga4/oauth/callback` |
| Local Docker | `http://localhost:3001/api/ga4/oauth/callback`           |

Keep the existing `/api/gsc/oauth/callback` URI if Search Console uses the same
client. The two are separate entries; Search Console keeps working while the
GA4 one is still propagating.

Adding a URI to an existing client is not instant. Search Console can already be
connected through that client and GA4 still fail with `redirect_uri_mismatch`
for a while — see Troubleshooting.

## 4) Set environment variables

Set these values and restart OpenSEO:

| Variable               | Value                                                     |
| ---------------------- | --------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Web application client ID.                                |
| `GOOGLE_CLIENT_SECRET` | Web application client secret.                            |
| `BETTER_AUTH_SECRET`   | Random string of at least 32 characters for token crypto. |

Generate the encryption secret with:

```sh
openssl rand -base64 32
```

Where to set them:

- **Docker self-hosting:** `.env`
- **Cloudflare:** `.env.selfhost`, then `pnpm deploy:selfhost --yes`
- **Local development:** `.env.local`

On Cloudflare, do **not** set these in the Workers dashboard — the Alchemy stack
reconciles worker vars on every deploy and overwrites dashboard values.

If Search Console is already connected, these three values are already set and
correct. GA4 adds no new variables, so **no redeploy is needed** — only the
redirect URI from step 3.

## 5) Connect a property

Open a project dashboard or **Project settings → Analytics**, click **Connect
with Google**, approve read-only Analytics access, and choose a GA4 property.

OpenSEO stores the OAuth tokens encrypted in Better Auth's account table. The
project mapping stores only the selected property metadata and connector
account. Disconnecting GA4 does not disconnect Search Console.

## Troubleshooting

**`redirect_uri_mismatch`** — make sure the registered URI exactly matches the
scheme, host, port, and `/api/ga4/oauth/callback` path used by the deployment,
and that it sits under **Authorized redirect URIs**, not **Authorized JavaScript
origins**.

If it does and the error persists, this is propagation delay on Google's side.
The Cloud Console warns that changes take between five minutes and several hours
to take effect. Search Console connecting successfully through the same client
does not mean the newly added GA4 URI is live yet. Wait, then retry once.

Google may render this as "this app doesn't comply with Google's OAuth 2.0
policies" rather than naming the mismatch. To confirm what was actually
requested, base64-decode the `authError` parameter of the
`accounts.google.com/signin/oauth/error` URL — it contains the literal
`redirect_uri` and `client_id` your deployment sent.

**No properties appear** — confirm that the Analytics Admin API is enabled and
the connected Google account has access to the property.

**Connection expired** — reconnect the Google account. OAuth apps left in
Google's Testing status can receive short-lived refresh grants.
