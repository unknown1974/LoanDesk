# Changes made for Zoho Catalyst

Prepared: 8 November 2026. Deployed separately, as authorized: 9 November 2026.
The user subsequently requested committing and pushing these changes to GitHub. No database seed, password reset or data migration was performed. Live login verification added normal login audit entries.

## Login fix on 9 November 2026

- Investigated the user's browser error, `Failed to fetch`. The real POST response contained two copies of `Access-Control-Allow-Origin`: one from Catalyst's gateway and one from Express. Browsers reject this even though command-line HTTP requests can read a successful login response.
- Added validated `CORS_MANAGED_BY_PLATFORM` in `server/src/config/env.js` and enabled it in `app-config.json`. `server/src/app.js` now lets Catalyst emit the headers while independently rejecting any supplied browser origin other than `CLIENT_ORIGIN`. Local development still uses Express CORS.
- Documented the flag in `server/.env.example`; expanded configuration and deployment tests for both modes and rejection of unrelated origins.
- Added `scripts/check-live.mjs` to require an exact single-origin header on preflight and real responses. Optional `--login` verifies the existing administrator without printing credentials or tokens.
- Rebuilt and redeployed the backend. Live verification: preflight 200; health 200; unauthenticated profile 401; administrator login 200; authenticated profile 200. Every response had exactly one correct allowed origin.
- Ten server tests and seven deployment tests passed; the deployment tests were run in both local and Catalyst CORS modes. No browser-rendered login success is claimed; the live response defect was verified fixed by exact header and authenticated API checks.
- At the time of the status question, remote `main` and local HEAD were both `16bb2a92e32c0503e678a8b8ff97698484a6e129`, without the deployment changes or login fix. No commit or push was performed in response to that question. The user's subsequent explicit commit request authorizes publishing the changes; private files remain ignored.

## Separate deployments on 9 November 2026

The user's follow-up explicitly approved deployment and required separate frontend/backend hosting. This supersedes the initial combined-AppSail plan below.

- Backend: `loandesk-api`, Node 24, 512 MB, Catalyst AppSail Development. Upload contains API code and production dependencies only.
- Frontend: `LoanDesk` 1.0.0, Catalyst Web Client Hosting Development. Upload contains compiled HTML/CSS/JavaScript and its client manifest only.
- Website: https://loandesk-60093268814.development.catalystserverless.in/app/index.html
- API: https://loandesk-api-50047454861.development.catalystappsail.in
- Daily notification Cron created: `loandesk_daily_notifications`, ID `104828000000024007`. Read-back verified it is enabled daily at 09:00 Asia/Kolkata, with the correct URL, POST method and matching authorization header.

Additional changed files:

| File | Follow-up change |
|---|---|
| `client/src/api.js` | Read public `VITE_API_URL`; send requests to the separate backend; preserve the hosted page path when redirecting expired sessions. |
| `client/src/main.jsx` | Use HashRouter for the hosted frontend so refreshes work under `/app/`; retain BrowserRouter for local development. |
| `client/vite.config.js` | Emit relative asset URLs for Catalyst's `/app/` mount. |
| `client/client-package.json` | Add Catalyst frontend name/version/homepage. Omit the optional 404 setting because Catalyst forbids it matching the homepage. |
| `client/.env.example` | Document public API URL and hash-routing options; no secrets. |
| `server/src/app.js` | Remove frontend/static-file serving. The backend is API-only; retain health/readiness and security middleware. |
| `scripts/build-catalyst.mjs` | Add independent `--backend` and `--frontend` builds; create separate `build/appsail` and `build/frontend` artifacts. Invoke npm without a shell. |
| `scripts/prepare-catalyst-release.mjs` | Require an exact HTTPS frontend origin for CORS; prepare a backend-only private release configuration. |
| `app-config.json`, `catalyst.json` | Backend hooks build only the API; frontend deploys independently from `build/frontend` at repository root. |
| `scripts/deployment.test.mjs` | Replace combined-site tests with API isolation and cross-origin checks; seven smoke tests pass. |
| `scripts/configure-catalyst-cron.cjs` | Create the approved daily schedule through the authenticated CLI's API client; use a fresh client per request and never print secret headers. |
| `server/.env.example`, `README.md`, deployment documents | Update configuration guidance, live URLs, deployment procedure and verification limitations. |

Verified live: API health/readiness 200; admin login and authenticated profile 200; frontend HTML/CSS/JavaScript 200; frontend bundle uses the deployed API; preflight allows the exact frontend origin. Ten server tests and seven API smoke tests pass locally. No financial test transactions were submitted.

Browser visual checks stopped because the computer-use tool could not reliably identify the Windows browser address. An immediate authenticated notification run was rejected by automatic approval review because it could modify loan/interest data outside the scheduled time; it was not executed. Saved schedule verification is read-only. The frontend initially hit Catalyst manifest/source-path validation; these were corrected before successful deployment.

## Initial preparation record (8 November)

## Existing work preserved

Before this task, `server/src/config/env.js` already prioritized `X_ZOHO_CATALYST_LISTEN_PORT`, and `catalyst.json` / `app-config.json` existed as untracked files. That port support was retained and validated; the configuration files were corrected rather than replaced with a different hosting approach. The existing `.catalystrc` project selection and `server/.env` were left unchanged.

## File-by-file changes

| File | Change and reason |
|---|---|
| `catalyst.json` | Set AppSail source to the repository root, where `app-config.json` resides; retained `loandesk-api`. |
| `app-config.json` | Set the build to `build/appsail`, direct Node startup, Node 24, 512 MB, production mode, external scheduling and build hooks. Explicitly retain application JWT authentication. No secrets committed. |
| `.catalystignore` | Exclude environment files, Git data, logs, tests and native binaries from Catalyst upload. |
| Root `package.json` | Add repeatable build, test, read-only database check and private release preparation commands; record Node requirements. |
| `scripts/build-catalyst.mjs` | Build the frontend and package only server source, manifests, static website and locked production dependencies. Verify the output path before clearing it and reject secrets/native binaries in the bundle. |
| `scripts/prepare-catalyst-env.mjs` | Prepare private cloud settings with new random JWT/job secrets; preserve any existing private file. |
| `scripts/prepare-catalyst-release.mjs` | Prepare an ignored CLI configuration with secrets outside the code upload; leave tracked configuration secret-free. Does not deploy. |
| `scripts/deployment.test.mjs` | Test the actual generated production bundle over HTTP without connecting to the user's database, including real early server startup. |
| `server/src/app.js` | Serve the React build and browser deep links; cache versioned assets, avoid caching HTML/API responses, preserve API errors, deny secret/missing-file paths, add readiness checks and a protected scheduler endpoint. Await database startup for a bounded interval on cold API requests. |
| `server/src/server.js` | Open the Catalyst port on all interfaces immediately, initialize MongoDB afterwards, publish readiness and handle termination. Remove global pre-listen interest processing. Sanitize database startup error output. |
| `server/src/config/database.js` | Disable query buffering, bound connection selection time and pool size; await model/index initialization before readiness. |
| `server/src/config/env.js` | Preserve Catalyst port priority; validate port, proxy count, cron settings and notification offsets. Reject weak/sample production JWT secrets and require a separate scheduler secret when using external scheduling. Same-origin hosting needs no cross-origin allowance. |
| `server/src/middleware/jobAuth.js` | Authenticate scheduled calls with a separate secret using fixed-length digest comparison. A user JWT cannot authorize the job. |
| `server/src/jobs/dailyNotificationJob.js` | Allow the local timer to be disabled for AppSail, return its task for shutdown, and prevent overlapping local scheduled runs. |
| `server/src/modules/interest/interest.service.js` | Create billing snapshots with insert-only upserts and recover from a duplicate-key race between instances. Existing snapshot values remain unchanged. This is not a substitute for transactional payment writes. |
| `server/scripts/checkDatabase.js` | Add read-only ping, approved-admin existence and transaction capability checks. No models/index creation, account reset or data writes. |
| `server/tests/config.test.js` | Test production secret rejection, Catalyst port priority and validation compatibility after dependency upgrades. |
| `server/.env.example` | Document proxy, scheduler secret and local/cloud scheduling choices. Real local secrets unchanged. |
| `server/package.json`, `server/package-lock.json` | Upgrade `node-cron` to 4.6.0 and Zod to 4.6.7 to clear reported dependency advisories. |
| `client/package.json`, `client/package-lock.json` | Upgrade React Router DOM to 7.18.5, Vite to 7.3.7 and the React Vite plugin to 5.2.0; preserve React 18 and Tailwind 3. Clear reported dependency advisories. |
| `client/src/receipt.js` | Replace the inline Print handler with an event listener so receipts work with the backend's Content Security Policy. |
| `README.md` | Update runtime guidance and explain the combined Catalyst build and external notification scheduling. |
| `CATALYST_DEPLOYMENT.md`, `CATALYST_CHANGES.md` | Record proposed deployment scope, commands, verification, remaining limitations and this full change list. |

## Generated local files (ignored by Git)

- `client/dist`: compiled website.
- `build/appsail`: upload-ready application code and dependencies, with no `.env` files.
- `.env.catalyst.local`: private MongoDB URI and generated secrets. No secret values printed in the chat or report.
- `build/catalyst-release`: private deployment configuration outside the code upload; not deployed.
- Installed dependencies and lockfile updates as described above.

## Verification

- 10 server/configuration/interest tests and 6 production-bundle smoke tests pass on both local Node 26.13.0 and Catalyst-compatible Node 24.22.2.
- Production frontend build and dependency packaging pass.
- Server and client dependency audits: zero known vulnerabilities at preparation time.
- Read-only Catalyst and MongoDB checks succeeded. No existing AppSail service was found; approved admin exists.
- Git whitespace checks pass; generated secrets are ignored.
- Initial restricted checks failed because registry, MongoDB or localhost access was blocked. Their approved reruns succeeded; these were environment access failures, not application test failures.

**Outstanding:** payment transactions and concurrency tests before live financial use; actual Catalyst network access, hosted login and external Cron validation after approved Development deployment. See the deployment guide for details.
