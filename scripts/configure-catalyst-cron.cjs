// Uses the authenticated Catalyst CLI, without printing tokens or job headers.
// Run only when deployment and the daily schedule have been authorized.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('../server/node_modules/dotenv');
const cli = process.env.CATALYST_CLI_LIB || path.join(process.env.APPDATA, 'npm/node_modules/zcatalyst-cli/lib');
const root = path.resolve(__dirname, '..');
const rc = JSON.parse(fs.readFileSync(path.join(root, '.catalystrc')));
const project = rc.projects.find((item) => item.idx === rc.actives.project);
const environment = project.env.find((item) => item.idx === rc.actives.env);
if (environment.name !== 'Development') throw new Error('This script only configures Development');
const settings = dotenv.parse(fs.readFileSync(path.join(root, '.env.catalyst.local')));
const backend = process.env.VITE_API_URL;
if (!backend || new URL(backend).protocol !== 'https:' || !settings.JOB_SECRET) throw new Error('Backend URL and job secret are required');
require(path.join(cli, 'command_needs/auth.js')).default();
const Api = require(path.join(cli, 'internal/api.js')).default;
const api = () => new Api({ authNeeded: true, env: environment.name, envId: environment.id });
const endpoint = `/baas/v1/project/${project.id}/cron`;
const name = 'loandesk_daily_notifications';

(async () => {
  const list = await api().get(endpoint);
  const existing = list.body.data.find((item) => item.cron_name === name);
  if (existing) {
    console.log(JSON.stringify({ id: existing.id, name, status: existing.cron_status, schedule: existing.cron_detail, action: 'Existing schedule preserved' }));
    return;
  }
  const response = await api().post(endpoint, {
    body: {
      cron_name: name,
      description: 'LoanDesk in-app due notifications, daily at 09:00 India time',
      cron_type: 'Calendar', status: true, end_time: -1,
      job_detail: { repetition_type: 'Daily', hour: 9, minute: 0, second: 0, timezone: 'Asia/Kolkata' },
      cron_url_details: {
        url: `${backend}/api/jobs/due-notifications`, request_method: 'POST',
        headers: { Authorization: `Bearer ${settings.JOB_SECRET}`, 'Content-Type': 'application/json' },
        params: {}, request_body: '{}',
      },
    },
    resolveOnError: true,
  });
  if (response.status < 200 || response.status >= 300) {
    console.error(JSON.stringify({ status: response.status, error: response.body?.data?.error_code, message: response.body?.data?.message }));
    process.exitCode = 1;
    return;
  }
  const created = (await api().get(`${endpoint}/${response.body.data.id}`)).body.data;
  console.log(JSON.stringify({ id: created.id, name: created.cron_name, status: created.cron_status, schedule: created.cron_detail }));
})().catch((error) => { console.error('Cron configuration failed:', error.message); process.exitCode = 1; });
