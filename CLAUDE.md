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

## Account discovery (`bing_ads_list_accounts`)

Added to solve prospect-account lookup: every other tool already accepts an explicit `account_id` and works for any account under the manager (client or not) via `resolveClient()`'s dynamic fallback — the missing piece was *discovery*, since account IDs were previously only documented in client repos' `context/accounts.md`.

Calls Microsoft's `GetAccountsInfo` Customer Management operation (`CUSTOMER_MGMT_BASE` — a distinct base URL from `CAMPAIGN_MGMT_BASE`/`REPORTING_BASE`). `OnlyParentAccounts: false` is deliberate — it includes *linked* accounts (accounts granted to Pathfinder without ownership transfer, e.g. sales prospects mid-discovery), not just accounts the manager customer owns directly.

**Do not route this call through `apiCall()`/`getHeaders()`.** Those assume a `ClientConfig` (customer_id + account_id) exists, which isn't true at discovery time — `GetAccountsInfo` only needs `Authorization` + `DeveloperToken` headers, with `CustomerId` as a body field, not a header. Use `customerApiCall()` instead.

**Response shape: the array key is `AccountsInfo` (plural), not `AccountInfo`.** Microsoft's REST response is `{"AccountsInfo": [...]}` — `AccountInfo` (singular) is only the *item* type name in Microsoft's schema docs, never a JSON key in the response body. The original implementation, its unit tests, and the design spec all independently assumed the singular key; the tool passed every deploy check (container health, session-persistence smoke test, `tools/list` registration) but threw `"Malformed GetAccountsInfo response: missing AccountInfo key"` on the first live call. Fixed in commit `c6c63b4` (2026-07-10) — see `pmin-brain/context/tool-gotchas.md`, "## Bing Ads MCP" section, for the full writeup. Verify any new Customer Management response shape against Microsoft's official REST reference (or a live call), not the SOAP type names.

**Write-tool reachability:** `mcp-bing-ads` has three write-capable tools (`bing_ads_pause_keywords`, `bing_ads_add_shared_negatives`, `bing_ads_update_campaign_budget`), all gated behind `BING_ADS_MCP_WRITE=true` (off by default). That gate is independent of account discoverability — a newly-discoverable prospect/former-client `account_id` is no more writable than any other account, because the write gate blocks by tool, not by how the account_id was found.

**No per-individual audit trail.** Every Pathfinder staff session authenticates through the same static `MCP_AUTH_TOKEN` issued by the OAuth PKCE flow in `server.js` — there is no per-caller identity anywhere in this MCP, for this tool or any other. Structured request logging captures timestamp and operation name only — not tool arguments (filter/account_id or otherwise), and not caller identity. This was explicitly surfaced and signed off during design (see the design spec in `pmin-apps/docs/nick/superpowers/specs/2026-07-09-bing-ads-prospect-account-lookup-design.hardened.md`) rather than left implicit.

## Conversion tracking (`bing_ads_list_conversion_goals`, `bing_ads_conversion_performance`)

Added because the three existing reporting tools only ever returned one aggregate conversion total per campaign/keyword/search-term, with no way to see which conversion goal (Purchase, Lead Form, Phone Call, etc.) drove it, and using Microsoft's deprecated `Conversions` column.

`listConversionGoals()` calls `GetConversionGoalsByIds` (Campaign Management, `CAMPAIGN_MGMT_BASE` — same base url as `listCampaigns`) through the existing `apiCall()`/`getHeaders()` path, requesting `ConversionGoalIds: []` for "all goals." `getConversionPerformance()` calls `ConversionPerformanceReportRequest` through the existing `submitReport()`/`waitForReport()` flow, identical in structure to `getKeywordPerformance`/`getSearchTermReport` — no new request-building path, no new polling logic for either tool.

**`by_goal` changes row grouping, not just content.** Including `Goal`/`GoalId`/`GoalType` as columns makes Microsoft's Reporting API return one row per campaign *per goal* instead of one aggregate row per campaign. Do not default this to `true` — it would silently change the shape every caller of the base (non-goal) form already relies on.

**No `goal_ids` filter parameter, deliberately.** Microsoft's `ConversionPerformanceReportRequest` has no field to filter by goal ID anywhere in its `Filter` or `Scope` objects — it isn't achievable as a server-side filter. If per-goal isolation is needed, use `by_goal: true` and filter the response client-side.

**Breaking change, not versioned/fallback-gated.** The `Conversions` field on the three existing reporting tools now sources from `ConversionsQualified` (Microsoft deprecated the legacy `Conversions` column in 2022). The JSON key is unchanged; the *values* are not directly comparable to pre-change values. This ships as a single breaking change with no parallel `use_qualified_conversions`-style parameter — if a real caller needs a migration path later, that's a separate decision made when the need is real, not built speculatively.

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
