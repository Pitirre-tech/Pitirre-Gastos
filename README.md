# Pitirre Tech · Gastos

Expense tracker for Pitirre Tech. Every expense carries its receipt (photo or PDF).
Same stack as the tracker suite: Next.js + Neon Postgres + Vercel, deployed from GitHub.

## What it does
- Add an expense from your phone: snap the receipt, amount, who you paid, date, IVU, category, payment method (incl. ATH Móvil), client/project, notes
- Receipt photos are shrunk on the phone (~300 KB) before upload and stored in Vercel Blob
- No receipt? Check "I don't have the receipt" — it's flagged in red until you add one
- Month view: total, IVU paid, spend by category (tap to filter), list with receipt thumbnails
- CSV download for the month or the whole year (for your accountant / Hacienda)
- English / Spanish toggle, PIN login, activity log table (`expense_log`)
- Installable to the home screen (Add to Home Screen)

## Receipt reading
When you snap or attach a receipt, Claude (Haiku 4.5 by default) reads it and fills in: who you paid, date, total,
IVU, a category guess, payment method, and every line item. Check the numbers, then save.
- Line items go into the `expense_items` table; the full reading (incl. receipt number, card last 4) goes into `expenses.receipt_data` (jsonb)
- Search on the main screen looks through vendors, notes, projects **and line items** across all dates ("vinilo", "tinta")
- "Download year items (CSV)" gives one row per item
- Cost: roughly half a cent or less per receipt at Haiku 4.5 rates. Set `RECEIPT_MODEL` to change models.
- No `ANTHROPIC_API_KEY`? The app still works; you just type the details.

## Safety nets
- **Permanent reference numbers**: every expense gets `2026-001`, `2026-002`… when it's saved, and keeps it. Adding a late receipt never renumbers anything you already sent. Numbers are never reused, so a gap means a deleted expense. Changing an expense's date to a different year gives it a number in that year.
- **Trash**: deleting moves an expense (and its receipt) to Trash. Restore it, or delete forever from there.
- **Refunds/returns**: check "This is a refund or return"; it's stored negative and reduces every total.
- **Business use %**: for receipts that were partly personal. The workbook's category/month totals use only the business portion.
- **Duplicate warning**: same amount on the same date (or same receipt number) asks before saving.

## Mileage log
Main screen → **Mileage log**. Log each business drive the same day: date, from, to, business purpose, client/project, and
miles (one way + "round trip"), or odometer start/end. **Repeat a recent trip** fills in regular routes with one tap.
Add odometer readings on **January 1 and December 31** (the screen reminds you); the workbook's **Mileage** sheet uses them
to show total miles driven and the business-use percentage, with a yellow rate-per-mile cell for your accountant.
Assumes one vehicle for the business-use percentage. Deleted trips go to Trash like expenses.

## Year-end package for the accountant
Main screen → **Year-end for your accountant**. It checks the year first (expenses without a receipt, anything left in
"Other") with links to fix each one, then downloads one ZIP:
- `Pitirre-Tech-gastos-2026.xlsx` (Spanish or English), sheets:
  **Resumen** (totals, IVU, category × month grid as live formulas, how-to notes) · **Gastos** (every expense: Ref., date,
  vendor, category, total, IVU, net of IVU, payment method, card last 4, receipt no., client/project, notes, clickable
  receipt link, receipt file name, and a yellow *Accountant notes* column) · **Artículos** (every line item) ·
  **Métodos de pago** (method × month, for matching bank/card statements) · **Clientes y proyectos** · **Sin recibo**
- `Recibos/` folder with every receipt named `2026-014_2026-03-12_Home-Depot_225.20.jpg`, matching the Ref. column
The ZIP is assembled in your browser, so it isn't limited by Vercel's response size. Optional env vars:
`BUSINESS_NAME`, `BUSINESS_EMAIL` (shown on the summary sheet).

## Income from Pitirre Hub
Set `HUB_DATABASE_URL` and the year-end workbook gains an **Income** sheet: every hub invoice issued or paid that year,
with services before IVU, IVU, total, status, date paid, amount received and amount withheld by the client, plus totals
(invoiced, received, withheld, IVU, still unpaid). Void invoices are listed but not totaled. The Summary sheet shows
income received and withheld.

Give this app **read-only** access. In the hub's Neon project → SQL Editor:
```sql
CREATE ROLE gastos_reader WITH LOGIN PASSWORD 'pick-a-long-random-password';
GRANT USAGE ON SCHEMA public TO gastos_reader;
GRANT SELECT ON invoices TO gastos_reader;
```
Then take the hub's pooled connection string, replace the user and password with `gastos_reader` and that password,
and put it in this app's `HUB_DATABASE_URL`.

## Setup (≈15 min)
1. **Neon**: create a project `pitirre-gastos`, open the SQL editor, run `db/schema.sql` (safe to re-run; it also adds the receipt-reading tables). Copy the pooled connection string.
2. **GitHub**: create a repo, push this folder.
3. **Vercel**: Import the repo. In the project → Storage → create a **Blob** store and connect it (adds `BLOB_STORE_ID`; new stores sign in automatically through Vercel OIDC, older ones use `BLOB_READ_WRITE_TOKEN`).
4. **Environment variables** (Vercel → Settings → Environment Variables):
   - `DATABASE_URL` — Neon connection string
   - `APP_PIN` — your login PIN. Use at least 6 digits (8 is better). After 5 wrong tries from one place, or 20 from anywhere, login locks for 15 minutes
   - `SESSION_SECRET` — long random string
   - `ANTHROPIC_API_KEY` — from console.anthropic.com (turns on receipt reading)
5. Deploy. Open it on your phone → Share → Add to Home Screen.

## Local dev
```
cp .env.example .env.local   # fill in values
npm install
npm run dev
```

## Notes
- Receipt files are stored with unguessable URLs (random suffix). Anyone with an exact URL can open it, so don't paste receipt links publicly.
- Categories and payment methods live in `lib/i18n.js` — edit there (both languages).
