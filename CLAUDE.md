# mcp-bing-ads

Fork of [bingads-mcp](https://github.com/bingads-mcp/bingads-mcp) with Pathfinder OAuth PKCE layer and manager-account support.

## Architecture

- **`server.js`** — Express OAuth proxy + stdio child-per-session manager (mcp-trello pattern). Handles PKCE auth, bearer token validation, and session lifecycle.
- **`src/index.ts`** → **`dist/index.js`** — The MCP server itself (TypeScript, compiled in Docker build stage). Spawned as a child process per session.
- **`Dockerfile`** — Multi-stage build: builder stage installs devDeps and runs `tsc`; runtime stage uses `--omit=dev` and copies `dist/`.

## Session handling

Follows the correct MCP stdio-per-session pattern (no session resurrection):

- No `mcp-session-id` + `initialize` → spawn new child, return new session ID
- Known session ID → reuse child, reset TTL
- Unknown session ID → 404 (client reinitializes cleanly per MCP spec)
- 30-min idle TTL per session

## Configuration

No `config.json` is used in production. Config is loaded entirely from env vars:

| Var | Required | Notes |
|---|---|---|
| `MCP_AUTH_TOKEN` | yes | Bearer token for claude.ai connector auth |
| `OAUTH_CLIENT_ID` | yes | `claude-pathfinder` |
| `OAUTH_CLIENT_SECRET` | yes | PKCE client secret |
| `BING_ADS_DEVELOPER_TOKEN` | yes | From Microsoft Advertising |
| `BING_ADS_CLIENT_ID` | yes | Azure app Application (Client) ID |
| `BING_ADS_REFRESH_TOKEN` | yes | OAuth refresh token (rotates on use — see below) |
| `BING_ADS_CUSTOMER_ID` | yes | Manager account customer ID (Pathfinder: `159333588`) |
| `BING_ADS_ACCOUNT_ID` | no | Default account ID — omit for manager-account mode |
| `BING_ADS_TOKEN_PATH` | yes | Path to this env file for token rotation write-back |

## Token rotation

The refresh token rotates on every use. `BING_ADS_TOKEN_PATH` points to the live env file so the new token is written back automatically. On the droplet this is `/opt/pmin-mcpinfrastructure/env/bing-ads.env`, mounted via a volume.

If the container restarts with a stale (already-consumed) refresh token, it will fail on the first API call. Update `BING_ADS_REFRESH_TOKEN` in the env file and restart.

## Manager account

`BING_ADS_CUSTOMER_ID=159333588` is the Pathfinder manager account. `BING_ADS_ACCOUNT_ID` is intentionally omitted — `resolveClient()` dynamically creates a `ClientConfig` for any `account_id` parameter passed to tools, using the manager customer ID as the parent.

## Azure app

- App name: **Bing Ads MCP** (Azure Portal → App registrations)
- Application (Client) ID: `4e6682ed-5c7a-4ad4-9d41-999e4bd469bd`
- Tenant: `common` (multi-tenant + personal accounts)
- Platform: Mobile and desktop applications (required for device code flow)
- "Allow public client flows": enabled
- Credentials stored in 1Password: `Claude_Remote_MCP - Bing Ads` (Claude Code vault)

## Healthcheck

Uses `wget` (not `curl`) — node:22-alpine doesn't include curl.

## Deployment

Deployed to `mcp-server` DO droplet at `https://bing-ads.mcp.pathfindermarketing.com.au/mcp`.
See `PM-Labs/pmin-mcpinfrastructure` for `docker-compose.yml`, `Caddyfile`, and `env-templates/bing-ads.env.example`.
