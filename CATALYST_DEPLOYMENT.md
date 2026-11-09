# LoanDesk — separate Catalyst deployments

Deployed on **9 November 2026**, following the user's explicit approval to deploy the frontend and backend separately.

## Live services

| Component | Hosting | URL |
|---|---|---|
| Frontend, LoanDesk 1.0.0 | Catalyst Web Client Hosting | https://loandesk-60093268814.development.catalystserverless.in/app/index.html |
| Backend, loandesk-api | Catalyst AppSail, Node 24, 512 MB | https://loandesk-api-50047454861.development.catalystappsail.in |

Project: **LoanDesk**, `104828000000021001`, India data centre. Both deployments are in **Development**, not promoted to Production. They use the existing MongoDB database; this is not an isolated test database.

Frontend routes use URL fragments, for example `/app/index.html#/login`, so a refresh does not require a backend route. Public frontend configuration includes only the API origin. MongoDB credentials, JWT signing key and scheduler secret remain server-side.

## Verified results

- Backend upload completed successfully. `/api/health` and `/api/ready` both returned 200 after initial connection startup.
- Existing administrator login returned 200 with the superadmin role; the authenticated profile endpoint returned 200. No passwords, account statuses or financial records were changed by these checks. Login produced normal audit entries.
- Cross-origin login was corrected after the user's browser reported `Failed to fetch`: Catalyst and Express had duplicated the allowed-origin header. `CORS_MANAGED_BY_PLATFORM=true` now leaves header generation to Catalyst, while the API still rejects unrelated browser origins. Exact single-origin headers were verified on preflight, health, denied profile requests, successful login and authenticated profile responses after redeployment.
- Frontend upload completed successfully. HTML and both generated CSS/JavaScript assets returned 200, and the JavaScript bundle references the separate deployed API.
- Ten server tests and seven API deployment smoke tests passed locally after splitting the application.
- The login fix was additionally tested in both CORS modes. `node scripts/check-live.mjs --login` passed against the live API; it verifies exact header values rather than merely checking response status. The earlier preflight-only check did not detect duplicate headers on actual responses.
- Previous dependency audits reported zero known vulnerabilities; dependency versions were not changed during the separate-deployment follow-up.
- Private environment files and generated release configurations are ignored by Git and excluded from both uploaded code packages.
- Catalyst Cron `loandesk_daily_notifications`, ID `104828000000024007`, was created. Read-back confirmed `cron_status: true`, daily at **09:00 Asia/Kolkata**, with no end date, the correct backend URL and POST method, and an authorization header matching the private scheduler key.

## Verification limits

The visual browser check was stopped by the computer-use tool because it could not reliably identify the current Windows browser URL. No visual end-to-end browser result is claimed; HTTP, cross-origin and authenticated API checks succeeded.

An immediate authenticated notification-job test was rejected by automatic approval review because it could change loan-interest data outside the authorized daily schedule. That unscheduled job was **not run**. The Cron's saved settings were checked read-only; scheduled execution history still needs monitoring after its first run. Notifications remain available through the app's existing authorized workflow.

## Rebuilding and redeploying independently

Use Node 24 LTS and the authenticated Catalyst CLI. Run from the repository root unless specified otherwise.

### Backend

```powershell
npm run prepare:catalyst-env
npm run build:catalyst -- --backend
npm test
npm run test:deployment
$env:CLIENT_ORIGIN='https://loandesk-60093268814.development.catalystserverless.in'
npm run prepare:catalyst-release
```

Then run from `build/catalyst-release`:

```powershell
catalyst deploy --only appsail:loandesk-api --project 104828000000021001 --dc in --non-interactive
```

The private release configuration supplies `MONGODB_URI`, `JWT_SECRET`, `JOB_SECRET` and the frontend `CLIENT_ORIGIN`. Do not deploy the backend using the root configuration alone: it deliberately omits secrets. `build/appsail` contains only API code and production dependencies, with no frontend files or local environment files.

Keep `CORS_MANAGED_BY_PLATFORM=true` for this AppSail deployment. The platform already supplies CORS headers for the project's hosted client. Keep it false for a standalone/local server that must supply its own headers. The application retains an exact `CLIENT_ORIGIN` check in platform mode.

After backend changes, run `node scripts/check-live.mjs` to verify live browser access headers. The optional `--login` mode uses the locally configured owner credentials and creates only the normal login audit entry, without submitting financial operations.

### Frontend

From the repository root:

```powershell
$env:VITE_API_URL='https://loandesk-api-50047454861.development.catalystappsail.in'
npm run build:catalyst -- --frontend
catalyst deploy --only client --project 104828000000021001 --dc in --non-interactive
```

`build/frontend` contains only compiled public files and `client-package.json`. The frontend must deploy from the repository root because Catalyst rejects a client source outside its project root. For later releases, increment `client/client-package.json`'s version when required, especially before Production promotion.

### Daily notification schedule

The local `node-cron` timer is disabled in AppSail because idle instances can shut down. The external Catalyst Cron invokes:

- Method: `POST`
- URL: `https://loandesk-api-50047454861.development.catalystappsail.in/api/jobs/due-notifications`
- Header: `Authorization: Bearer <JOB_SECRET>`
- Header: `Content-Type: application/json`
- Body: `{}`
- Schedule: 09:00 every day, `Asia/Kolkata`

The setup helper preserves an existing schedule of the same name:

```powershell
$env:VITE_API_URL='https://loandesk-api-50047454861.development.catalystappsail.in'
node scripts/configure-catalyst-cron.cjs
```

This helper uses the installed authenticated Catalyst CLI. On a non-Windows machine, set `CATALYST_CLI_LIB` to that installation's `lib` directory. It must only be used for an authorized schedule change. It does not execute the notification job immediately. If the secret changes, update the saved Cron header as well; the helper intentionally preserves existing schedules.

## Private files and data

- `.env.catalyst.local` holds the existing MongoDB URI and independent random 48-byte JWT/job secrets. Its preparation script never rotates an existing file.
- `build/catalyst-release/app-config.json` contains secrets needed by the backend CLI deployment. This directory is outside both code-upload roots. Never commit or share it.
- Root `app-config.json` contains only non-secret defaults. `server/.env` and the existing `.catalystrc` project selection were not changed.
- No demo seed, account reset, migration or payment test was run. A deployed app using the existing database can modify its real data when users operate it.
- Future deployment verification should check readiness, login and read-only endpoints. Obtain approval before any unscheduled job that can alter financial records.

## Remaining production work

**This is a Development deployment, not certification for live financial use.** Existing payment and reversal flows update several documents without transactions. Concurrent requests or interruptions can leave balances inconsistent. Add transaction handling and concurrency/rollback tests against a separate replica-set test database before taking real payments.

Other operational checks:

- Login rate limits are per instance and reset on restart. Consider gateway/shared limits for public production use; verify the effective proxy hop count.
- Monitor Cron success/failure after its first scheduled execution. Missed notification-day offsets are not backfilled.
- Notification processing is sequential and must fit AppSail's request duration limit; batch or move it to background jobs for larger datasets.
- Verify backup policy, browser workflows, production environment variables and database access separately before Production promotion.

## References and change record

Before the user's GitHub commit request on 9 November 2026, GitHub `main` and local HEAD were both `16bb2a9`; deployment had not committed or pushed the changes. The subsequent commit includes the deployment preparation, split hosting, login fix and these records. Private credentials and generated artifacts remain excluded; use Git history to identify the published revision.

- [Full change log](CATALYST_CHANGES.md)
- [Catalyst client manifest](https://docs.catalyst.zoho.com/en/cli/v1/project-directory-structure/client-directory/)
- [AppSail configuration](https://docs.catalyst.zoho.com/en/serverless/help/appsail/appsail-configurations/)
- [AppSail execution limits](https://docs.catalyst.zoho.com/en/serverless/help/appsail/appsail-basics/)
- [Catalyst Cron URL targets and headers](https://docs.catalyst.zoho.com/en/cloud-scale/help/cron/implementation/)
