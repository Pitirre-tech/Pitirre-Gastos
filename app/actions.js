'use server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { put, del } from '@vercel/blob';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';
import { makeToken, verifyToken } from '@/lib/auth';
import { CATEGORIES, METHODS } from '@/lib/i18n';
import { extractReceipt } from '@/lib/receipt';

// Turns a save failure into a specific on-screen reason (details still go to Vercel → Logs).
function saveError(x) {
  console.error('Save failed:', x?.message || x);
  const m = String(x?.message || x || '').toLowerCase();
  if (m.includes('blob') && m.includes('token')) return 'saveNoBlob';
  if (m.includes('blob') && (m.includes('private') || m.includes('access'))) return 'saveBlobPrivate';
  if (m.includes('blob')) return 'saveBlob';
  if (m.includes('does not exist') && (m.includes('relation') || m.includes('column'))) return 'saveNoTable';
  if (m.includes('password authentication') || m.includes('connection') || m.includes('database_url') || m.includes('fetch failed')) return 'saveDb';
  return 'failed';
}

async function requireAuth() {
  const ok = await verifyToken((await cookies()).get('session')?.value);
  if (!ok) redirect('/login');
}

// ---------- login with lockout ----------
const MAX_PER_IP = 5;      // wrong PINs per IP in 15 min
const MAX_GLOBAL = 20;     // wrong PINs from anywhere in 15 min

function samePin(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function login(formData) {
  const pin = String(formData.get('pin') || '');
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const sql = db();
  await sql`delete from login_failures where at < now() - interval '1 day'`;
  const [{ mine, total }] = await sql`
    select count(*) filter (where ip = ${ip})::int as mine, count(*)::int as total
    from login_failures where at > now() - interval '15 minutes'`;
  if (mine >= MAX_PER_IP || total >= MAX_GLOBAL) redirect('/login?e=locked');

  if (!process.env.APP_PIN || !samePin(pin, process.env.APP_PIN)) {
    await sql`insert into login_failures (ip) values (${ip})`;
    await new Promise((r) => setTimeout(r, 800));
    redirect('/login?e=1');
  }
  await sql`delete from login_failures where ip = ${ip}`;
  (await cookies()).set('session', await makeToken(), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === 'production',
  });
  redirect('/');
}

export async function logout() {
  (await cookies()).delete('session');
  redirect('/login');
}

export async function setLang(lang) {
  (await cookies()).set('lang', lang === 'es' ? 'es' : 'en', { path: '/', maxAge: 60 * 60 * 24 * 365 });
  revalidatePath('/', 'layout');
}

// ---------- parsing ----------
function parse(fd) {
  const num = (v) => Math.round(Math.abs(Number(String(v ?? '').replace(/[$,\s-]/g, ''))) * 100) / 100;
  const refund = fd.get('refund') === 'on';
  const sign = refund ? -1 : 1;
  const ivu = num(fd.get('ivu'));
  const pct = Math.round(Number(fd.get('business_pct') || 100));
  return {
    spent_on: String(fd.get('spent_on') || ''),
    vendor: String(fd.get('vendor') || '').trim(),
    category: CATEGORIES.includes(fd.get('category')) ? fd.get('category') : 'other',
    amount: sign * num(fd.get('amount')),
    ivu: Number.isFinite(ivu) ? sign * ivu : 0,
    business_pct: Number.isFinite(pct) ? Math.min(100, Math.max(1, pct)) : 100,
    payment_method: METHODS.includes(fd.get('payment_method')) ? fd.get('payment_method') : 'card',
    client_project: String(fd.get('client_project') || '').trim() || null,
    notes: String(fd.get('notes') || '').trim() || null,
    receipt_missing: fd.get('receipt_missing') === 'on',
  };
}

function validate(e) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.spent_on)) return 'needDate';
  if (!e.vendor) return 'needVendor';
  if (!Number.isFinite(e.amount) || e.amount === 0) return 'needAmount';
  return null;
}

function parseItems(fd) {
  const n = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  try {
    const arr = JSON.parse(fd.get('items') || '[]');
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((i) => i && String(i.description || '').trim())
      .slice(0, 150)
      .map((i) => ({ description: String(i.description).trim().slice(0, 300), qty: n(i.qty), unit_price: n(i.unit_price), total: n(i.total) }));
  } catch {
    return [];
  }
}

function parseReceiptData(fd) {
  const raw = fd.get('receipt_data');
  if (!raw || typeof raw !== 'string' || raw.length > 60000) return { raw: null, number: null };
  try {
    const d = JSON.parse(raw);
    return { raw, number: d?.receipt_number ? String(d.receipt_number) : null };
  } catch {
    return { raw: null, number: null };
  }
}

async function uploadReceipt(file, spentOn) {
  if (!file || typeof file === 'string' || !file.size) return null;
  const ext = file.type === 'application/pdf' ? 'pdf' : 'jpg';
  const blob = await put(`receipts/${spentOn.slice(0, 7)}/receipt.${ext}`, file, {
    access: 'public', addRandomSuffix: true, contentType: file.type || 'image/jpeg',
  });
  return blob.url;
}

async function saveItems(sql, id, items) {
  await sql`delete from expense_items where expense_id = ${id}`;
  if (!items.length) return;
  await sql`
    insert into expense_items (expense_id, description, qty, unit_price, total)
    select ${id}, d, q, u, t
    from unnest(${items.map((i) => i.description)}::text[], ${items.map((i) => i.qty)}::numeric[],
                ${items.map((i) => i.unit_price)}::numeric[], ${items.map((i) => i.total)}::numeric[]) as x(d, q, u, t)`;
}

// ---------- receipt reading ----------
export async function readReceipt(fd) {
  await requireAuth();
  if (!process.env.ANTHROPIC_API_KEY) return { error: 'readOff' };
  const file = fd.get('receipt');
  if (!file || typeof file === 'string' || !file.size) return { error: 'readFailed' };
  try {
    const data = await extractReceipt(file);
    return data ? { ok: true, data } : { error: 'readFailed' };
  } catch (x) {
    console.error(x.message || x);
    const msg = String(x.detail || x.message || '').toLowerCase();
    if (msg.includes('credit balance')) return { error: 'readNoCredit' };
    if (x.status === 401 || x.type === 'authentication_error') return { error: 'readBadKey' };
    if (x.status === 403 || x.type === 'permission_error' || msg.includes('workspace')) return { error: 'readWorkspace' };
    if (x.status === 404 || x.type === 'not_found_error') return { error: 'readModel' };
    if (x.status === 429 || x.type === 'rate_limit_error') return { error: 'readLimit' };
    if (msg.includes('image') || msg.includes('pdf') || msg.includes('media')) return { error: 'readBadFile' };
    return { error: 'readFailed' };
  }
}

// ---------- create / update ----------
export async function createExpense(fd) {
  await requireAuth();
  const e = parse(fd);
  const err = validate(e);
  if (err) return { error: err };
  const rd = parseReceiptData(fd);
  const sql = db();

  try {
    if (fd.get('confirm_dup') !== '1') {
      const [dup] = await sql`
        select id, ref, vendor, to_char(spent_on,'YYYY-MM-DD') as spent_on, amount::float as amount
        from expenses
        where deleted_at is null and amount = ${e.amount}
          and (spent_on = ${e.spent_on}::date
               or (${rd.number}::text is not null and receipt_data->>'receipt_number' = ${rd.number}))
        order by id desc limit 1`;
      if (dup) return { duplicate: dup };
    }

    const url = await uploadReceipt(fd.get('receipt'), e.spent_on);
    if (!url && !e.receipt_missing) return { error: 'needReceipt' };
    const year = Number(e.spent_on.slice(0, 4));
    const [row] = await sql`
      with n as (
        insert into ref_counters (year, last) values (${year}, 1)
        on conflict (year) do update set last = ref_counters.last + 1
        returning last
      )
      insert into expenses (spent_on, vendor, category, amount, ivu, business_pct, payment_method, client_project, notes,
                            receipt_url, receipt_missing, receipt_data, ref)
      select ${e.spent_on}::date, ${e.vendor}::text, ${e.category}::text, ${e.amount}::numeric, ${e.ivu}::numeric,
             ${e.business_pct}::int, ${e.payment_method}::text, ${e.client_project}::text, ${e.notes}::text,
             ${url}::text, ${!url}::boolean, ${rd.raw}::jsonb,
             ${year}::text || '-' || lpad(n.last::text, greatest(3, length(n.last::text)), '0')
      from n
      returning id, ref`;
    await saveItems(sql, row.id, parseItems(fd));
    await sql`insert into expense_log (expense_id, action, detail) values (${row.id}, 'created', ${`${row.ref} ${e.vendor} ${e.amount}`})`;
  } catch (x) {
    return { error: saveError(x) };
  }
  revalidatePath('/');
  return { ok: true };
}

export async function updateExpense(id, fd) {
  await requireAuth();
  const e = parse(fd);
  const err = validate(e);
  if (err) return { error: err };
  const rd = parseReceiptData(fd);
  try {
    const sql = db();
    const [old] = await sql`select receipt_url, ref from expenses where id = ${id} and deleted_at is null`;
    if (!old) return { error: 'failed' };
    const newUrl = await uploadReceipt(fd.get('receipt'), e.spent_on);
    const url = newUrl || old.receipt_url;
    if (!url && !e.receipt_missing) return { error: 'needReceipt' };

    const year = Number(e.spent_on.slice(0, 4));
    const sameYear = old.ref && old.ref.startsWith(`${year}-`);
    if (sameYear) {
      await sql`
        update expenses set spent_on = ${e.spent_on}, vendor = ${e.vendor}, category = ${e.category},
          amount = ${e.amount}, ivu = ${e.ivu}, business_pct = ${e.business_pct}, payment_method = ${e.payment_method},
          client_project = ${e.client_project}, notes = ${e.notes},
          receipt_url = ${url}, receipt_missing = ${!url},
          receipt_data = coalesce(${rd.raw}::jsonb, receipt_data), updated_at = now()
        where id = ${id}`;
    } else {
      // Date moved to another year: it gets a new number in that year's sequence.
      await sql`
        with n as (
          insert into ref_counters (year, last) values (${year}, 1)
          on conflict (year) do update set last = ref_counters.last + 1
          returning last
        )
        update expenses set spent_on = ${e.spent_on}::date, vendor = ${e.vendor}::text, category = ${e.category}::text,
          amount = ${e.amount}::numeric, ivu = ${e.ivu}::numeric, business_pct = ${e.business_pct}::int,
          payment_method = ${e.payment_method}::text, client_project = ${e.client_project}::text, notes = ${e.notes}::text,
          receipt_url = ${url}::text, receipt_missing = ${!url}::boolean,
          receipt_data = coalesce(${rd.raw}::jsonb, receipt_data), updated_at = now(),
          ref = ${year}::text || '-' || lpad(n.last::text, greatest(3, length(n.last::text)), '0')
        from n where expenses.id = ${id}`;
    }
    await saveItems(sql, id, parseItems(fd));
    if (newUrl && old.receipt_url) await del(old.receipt_url).catch(() => {});
    await sql`insert into expense_log (expense_id, action, detail) values (${id}, 'edited', ${`${e.vendor} ${e.amount}`})`;
  } catch (x) {
    return { error: saveError(x) };
  }
  revalidatePath('/');
  revalidatePath(`/e/${id}`);
  return { ok: true };
}

// ---------- trash ----------
export async function trashExpense(id) {
  await requireAuth();
  const sql = db();
  await sql`update expenses set deleted_at = now() where id = ${id} and deleted_at is null`;
  await sql`insert into expense_log (expense_id, action) values (${id}, 'trashed')`;
  revalidatePath('/');
  redirect('/');
}

export async function restoreExpense(id) {
  await requireAuth();
  const sql = db();
  await sql`update expenses set deleted_at = null where id = ${id}`;
  await sql`insert into expense_log (expense_id, action) values (${id}, 'restored')`;
  revalidatePath('/');
  revalidatePath('/trash');
}

export async function purgeExpense(id) {
  await requireAuth();
  const sql = db();
  const [row] = await sql`delete from expenses where id = ${id} and deleted_at is not null returning ref, vendor, amount, receipt_url`;
  if (row?.receipt_url) await del(row.receipt_url).catch(() => {});
  if (row) await sql`insert into expense_log (expense_id, action, detail) values (${id}, 'purged', ${`${row.ref} ${row.vendor} ${row.amount}`})`;
  revalidatePath('/trash');
}
