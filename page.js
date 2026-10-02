import Link from 'next/link';
import { db } from '@/lib/db';
import { getT, money, fill, CATEGORIES } from '@/lib/i18n';
import { todayPR, monthRange, monthLabel, shortDate } from '@/lib/dates';
import Top from '@/components/Top';

export const dynamic = 'force-dynamic';

function Thumb({ url, label }) {
  if (!url) return <span className="thumb none" aria-label={label}>!</span>;
  if (url.endsWith('.pdf')) return <span className="thumb pdf-t">PDF</span>;
  return <img className="thumb" src={url} alt="" loading="lazy" />;
}

export default async function Home({ searchParams }) {
  const sp = await searchParams;
  const { t, lang } = await getT();
  const month = /^\d{4}-\d{2}$/.test(sp.m || '') ? sp.m : todayPR().slice(0, 7);
  const cat = CATEGORIES.includes(sp.c) ? sp.c : null;
  const onlyMissing = sp.r === 'missing';
  const q = String(sp.q || '').trim().slice(0, 80) || null;
  const like = q ? `%${q}%` : null;
  const { start, end, prev, next } = monthRange(month);
  const sql = db();

  const [[sum], byCat, rows] = await Promise.all([
    sql`select coalesce(sum(amount),0) as total, coalesce(sum(ivu),0) as ivu, count(*)::int as n,
               coalesce(sum(amount * business_pct / 100.0),0) as business,
               count(*) filter (where receipt_url is null)::int as missing
        from expenses where deleted_at is null and spent_on >= ${start} and spent_on < ${end}`,
    sql`select category, sum(amount) as total from expenses
        where deleted_at is null and spent_on >= ${start} and spent_on < ${end} group by category order by total desc`,
    sql`select id, to_char(spent_on,'YYYY-MM-DD') as spent_on, vendor, category, amount, receipt_url
        from expenses
        where deleted_at is null and (${like}::text is not null or (spent_on >= ${start} and spent_on < ${end}))
          and (${like}::text is null or vendor ilike ${like} or notes ilike ${like} or client_project ilike ${like}
               or exists (select 1 from expense_items i where i.expense_id = expenses.id and i.description ilike ${like}))
          and (${cat}::text is null or category = ${cat})
          and (${onlyMissing} = false or receipt_url is null)
        order by spent_on desc, id desc
        limit 300`,
  ]);

  const max = Math.max(1, ...byCat.map((c) => Number(c.total)));
  const filtered = cat || onlyMissing || q;
  const base = `/?m=${month}`;

  return (
    <main className="wrap">
      <Top t={t} lang={lang} />

      <nav className="month" aria-label={monthLabel(month, lang)}>
        <Link href={`/?m=${prev}`} aria-label={t.prev}>‹</Link>
        <h1>{monthLabel(month, lang)}</h1>
        <Link href={`/?m=${next}`} aria-label={t.next}>›</Link>
      </nav>

      <section className="sum">
        <p className="big">{money(sum.total, lang)}</p>
        <p className="meta">
          {fill(t.count, { n: sum.n })}, {fill(t.ivuPaid, { x: money(sum.ivu, lang) })}
        </p>
        {Math.abs(Number(sum.business) - Number(sum.total)) > 0.004 && (
          <p className="meta">{fill(t.businessPortion, { x: money(sum.business, lang) })}</p>
        )}
        {sum.missing > 0 && (
          <Link className="warn" href={onlyMissing ? base : `${base}&r=missing`}>
            {onlyMissing ? t.showAll : fill(t.missing, { n: sum.missing })}
          </Link>
        )}
      </section>

      {byCat.length > 0 && (
        <section className="cats" aria-label={t.byCategory}>
          {byCat.map((c) => {
            const active = cat === c.category;
            return (
              <Link key={c.category} href={active ? base : `${base}&c=${c.category}`} className={`cat ${active ? 'on' : ''}`}>
                <span className="cat-name">{t.cat[c.category] || c.category}</span>
                <span className="cat-amt">{money(c.total, lang)}</span>
                <span className="bar"><b style={{ width: `${(Number(c.total) / max) * 100}%` }} /></span>
              </Link>
            );
          })}
        </section>
      )}

      <form className="search" action="/" role="search">
        <input type="hidden" name="m" value={month} />
        <input type="search" name="q" defaultValue={q || ''} placeholder={t.searchPh} aria-label={t.searchPh} />
      </form>
      {q && (
        <p className="results">{fill(t.results, { q })} <Link href={base}>{t.clear}</Link></p>
      )}

      <section className="list">
        {rows.length === 0 && <p className="empty">{filtered ? t.emptyFiltered : t.empty}</p>}
        {rows.map((r) => (
          <Link key={r.id} href={`/e/${r.id}`} className="row">
            <Thumb url={r.receipt_url} label={t.noReceipt} />
            <span className="row-main">
              <span className="row-vendor">{r.vendor}</span>
              <span className="row-sub">{q ? r.spent_on : shortDate(r.spent_on, lang)}, {t.cat[r.category] || r.category}</span>
            </span>
            <span className={`row-amt ${Number(r.amount) < 0 ? 'neg' : ''}`}>{money(r.amount, lang)}</span>
          </Link>
        ))}
      </section>

      <Link href={`/year?y=${month.slice(0, 4)}`} className="year-link">{t.yearEnd}</Link>

      <footer className="exports">
        <a href={`/api/export?m=${month}`}>{t.exportMonth}</a>
        <a href={`/api/export?y=${month.slice(0, 4)}`}>{t.exportYear}</a>
        <a href={`/api/export?y=${month.slice(0, 4)}&items=1`}>{t.exportItems}</a>
        <Link href="/trash">{t.trash}</Link>
      </footer>

      <Link href="/new" className="fab">+ {t.add}</Link>
    </main>
  );
}
