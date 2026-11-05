# LoanDesk

Multi-user lending and interest management (super admin, lenders, borrowers): borrowers, loans with individual rates, partial payments,
immutable payment history with reversals, interest-period history, in-app due-date notifications, reports.

Stack: React + Vite + Tailwind · Node + Express · MongoDB (Mongoose) · JWT · node-cron.

## Run it

Requires Node 18+ and a MongoDB (local or Atlas).

```bash
# 1. API
cd server
npm install
cp .env.example .env      # set MONGODB_URI, JWT_SECRET, OWNER_EMAIL, OWNER_PASSWORD
npm run seed              # creates your login
npm run seed:demo         # optional: sample borrowers, loans and payments (empty DB only)
npm run dev               # http://localhost:5000

# 2. Web app (second terminal)
cd client
npm install
npm run dev               # http://localhost:5173  (proxies /api to :5000)
```

Tests (interest engine): `cd server && npm test`

## Roles and approvals

| Role | How they get an account | What they can do |
|---|---|---|
| **Super admin** | Created by `npm run seed` | Everything, across all lenders. Creates lenders directly or approves lender requests. Can also lend (has own lender code). |
| **Lender** | Created by the super admin, **or** requests one at `/register/lender` and the super admin approves | Sees and manages only their own borrowers, loans, payments, reports and notifications. Approves their borrowers' login requests. |
| **Borrower** | Requests a login at `/register/borrower` using their lender's **lender code**; the lender **or** the super admin approves | Read-only page: their loan amount, time running, rate, dues, interest by month, payment history and status. |

- Each lender has a **lender code** (Settings page). Borrowers type it when requesting a login so the request reaches the right lender.
- On approval, a borrower login is linked to a borrower record: you pick one from a list, or leave it on "Auto" to match by phone number (or create a new record).
- Accounts can be disabled and re-enabled under **Accounts**. Disabling logs the person out on their next request.
- Lenders can never see each other's data: every query is filtered by the owning lender on the server.

### Upgrading from the single-user version
1. Replace the project files, then in `server` run `npm install` (no new packages) and `npm run seed` again.
   This converts your login to super admin and assigns all your existing borrowers, loans, payments and notifications to you.
2. Everyone must log in again (old sessions are not valid any more).

## How the money works

- Amounts are integer **paise**; rates are **basis points per month** (2% = 200). No floating-point rupees stored.
- Each loan is billed in monthly periods anchored to its start day (31 Jan → 28 Feb → 31 Mar).
- Interest for a period is calculated on the **principal at the start of that period**, then frozen
  (rate, method and principal are snapshotted on the period). Principal repaid mid-period lowers the *next* period.
- Methods: `monthly` (principal × rate) or `daily` (principal × rate ÷ 30 × days in period).
- Rate changes only affect periods created afterwards; the loan keeps a rate history.
- Interest payments are applied to the oldest unpaid periods first; partial payments are supported.
- Payments can't be edited or deleted. A wrong entry is fixed with **Reverse**, which adds a reversal record.
  A principal payment can't be reversed once a new interest period has started (it would rewrite interest already calculated).
- For a loan that is already running, set the start date to when its current unpaid cycle began.

## Notifications

- Notifications appear in the bell at the top of the app. No SMS or email is sent.
- A daily job (default 9:00 AM IST, `CRON_SCHEDULE`) adds a notification for each unpaid interest period that is due
  in 3 days and again on the due date (`NOTIFY_DAYS_BEFORE=3,0`). Paid periods and inactive borrowers are skipped.
- The same period never notifies twice for the same day offset, so running the check repeatedly is safe.
- The check also runs when the server starts, and "Check now" in the bell runs it on demand.
- The server must be running at the scheduled time. If it was off on the exact day, that day's notification is missed
  (the Dashboard still lists anything overdue).
- Click a notification to open that loan.

## Before production

- Use a long random `JWT_SECRET`, HTTPS, and set `CLIENT_ORIGIN` to your real site.
- Enable MongoDB Atlas backups. Recording a payment writes several documents without a transaction
  (works on standalone MongoDB); on Atlas you can wrap it in a session transaction.
- Review audit logs (`auditLogs` collection) periodically.
