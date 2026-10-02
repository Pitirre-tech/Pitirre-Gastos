import { db } from '@/lib/db';
import { getT, money } from '@/lib/i18n';
import { shortDate } from '@/lib/dates';
import { restoreExpense, purgeExpense } from '@/app/actions';
import { ConfirmButton } from '@/components/ExpenseForm';
import Top from '@/components/Top';

export const dynamic = 'force-dynamic';

export default async function Trash() {
  const { t, lang } = await getT();
  const rows = await db()`
    select id, ref, to_char(spent_on,'YYYY-MM-DD') as spent_on, vendor, amount, receipt_url
    from expenses where deleted_at is not null order by deleted_at desc`;
  return (
    <main className="wrap">
      <Top t={t} lang={lang} back />
      <h1 className="page-title">{t.trash}</h1>
      <p className="intro">{t.trashIntro}</p>
      {rows.length === 0 ? <p className="empty">{t.trashEmpty}</p> : (
        <section className="list">
          {rows.map((r) => (
            <div key={r.id} className="trash-row">
              <div>
                <p className="row-vendor">{r.vendor} <span className="money">{money(r.amount, lang)}</span></p>
                <p className="row-sub">
                  {r.ref}, {shortDate(r.spent_on, lang)}
                  {r.receipt_url && <>, <a href={r.receipt_url} target="_blank" rel="noreferrer">{t.openReceipt}</a></>}
                </p>
              </div>
              <div className="trash-actions">
                <form action={restoreExpense.bind(null, r.id)}><button className="chip">{t.restore}</button></form>
                <ConfirmButton action={purgeExpense.bind(null, r.id)} label={t.purge} confirmText={t.confirmPurge} className="chip danger-chip" />
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
