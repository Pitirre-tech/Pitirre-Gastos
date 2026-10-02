import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getT } from '@/lib/i18n';
import { todayPR } from '@/lib/dates';
import { updateExpense, trashExpense, readReceipt } from '@/app/actions';
import ExpenseForm, { ConfirmButton } from '@/components/ExpenseForm';
import Top from '@/components/Top';

export const dynamic = 'force-dynamic';

export default async function EditExpense({ params }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const { t, lang } = await getT();
  const sql = db();
  const [row] = await sql`
    select id, ref, to_char(spent_on,'YYYY-MM-DD') as spent_on, vendor, category, amount::float as amount,
           nullif(ivu,0)::float as ivu, business_pct, payment_method, client_project, notes, receipt_url, receipt_missing
    from expenses where id = ${id} and deleted_at is null`;
  if (!row) notFound();
  row.items = await sql`
    select description, qty::float as qty, unit_price::float as unit_price, total::float as total
    from expense_items where expense_id = ${id} order by id`;

  return (
    <main className="wrap">
      <Top t={t} lang={lang} back />
      <p className="ref">{row.ref}</p>
      <h1 className="page-title">{row.vendor}</h1>
      {row.receipt_url
        ? <a className="open-receipt" href={row.receipt_url} target="_blank" rel="noreferrer">{t.openReceipt}</a>
        : <p className="error">{t.noReceipt}</p>}
      <ExpenseForm action={updateExpense.bind(null, id)} readAction={readReceipt} lang={lang} t={t} today={todayPR()} initial={row} submitLabel={t.saveChanges} />
      <ConfirmButton action={trashExpense.bind(null, id)} label={t.del} confirmText={t.confirmDel} />
    </main>
  );
}
