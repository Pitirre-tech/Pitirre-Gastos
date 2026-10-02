import Link from 'next/link';
import { getT, dictFor, money, fill } from '@/lib/i18n';
import { getYear } from '@/lib/yeardata';
import { todayPR, shortDate } from '@/lib/dates';
import Top from '@/components/Top';
import YearDownloads from '@/components/YearDownloads';

export const dynamic = 'force-dynamic';

const pick = (d) => ({
  wbName: d.wbName, receiptsFolder: d.receiptsFolder, wbLang: d.wbLang, downloadPackage: d.downloadPackage,
  downloadExcel: d.downloadExcel, building: d.building, zipping: d.zipping, doneMsg: d.doneMsg,
  someFailed: d.someFailed, bigHint: d.bigHint, failed: d.failed,
});

export default async function YearEnd({ searchParams }) {
  const sp = await searchParams;
  const { t, lang } = await getT();
  const year = /^\d{4}$/.test(sp.y || '') ? sp.y : todayPR().slice(0, 4);
  const { rows } = await getYear(year);

  const total = rows.reduce((a, r) => a + r.amount, 0);
  const ivu = rows.reduce((a, r) => a + (r.ivu || 0), 0);
  const missing = rows.filter((r) => !r.receipt_url);
  const other = rows.filter((r) => r.category === 'other');
  const files = rows.filter((r) => r.receipt_url).map((r) => ({ url: r.receipt_url, file: r.file }));

  return (
    <main className="wrap">
      <Top t={t} lang={lang} back />
      <nav className="month">
        <Link href={`/year?y=${Number(year) - 1}`} aria-label={t.prevYear}>‹</Link>
        <h1>{fill(t.yearTitle, { y: year })}</h1>
        <Link href={`/year?y=${Number(year) + 1}`} aria-label={t.nextYear}>›</Link>
      </nav>

      {rows.length === 0 ? (
        <p className="empty">{fill(t.noneYear, { y: year })}</p>
      ) : (
        <>
          <section className="sum">
            <p className="big">{money(total, lang)}</p>
            <p className="meta">{fill(t.count, { n: rows.length })}, {fill(t.ivuPaid, { x: money(ivu, lang) })}</p>
          </section>

          <p className="intro">{t.yearIntro}</p>

          <section className="checks">
            {missing.length === 0 && other.length === 0 && <p className="ok">{t.checkOk}</p>}
            {missing.length > 0 && (
              <div className="check-block">
                <p className="error">{fill(t.checkMissing, { n: missing.length })}</p>
                <ul>
                  {missing.map((r) => (
                    <li key={r.id}><Link href={`/e/${r.id}`}>{r.ref}, {shortDate(r.spent_on, lang)}, {r.vendor}, {money(r.amount, lang)}</Link></li>
                  ))}
                </ul>
              </div>
            )}
            {other.length > 0 && (
              <div className="check-block">
                <p className="warn-text">{fill(t.checkOther, { n: other.length })}</p>
                <ul>
                  {other.map((r) => (
                    <li key={r.id}><Link href={`/e/${r.id}`}>{r.ref}, {r.vendor}, {money(r.amount, lang)}</Link></li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <YearDownloads year={year} files={files} defaultLang={lang}
            labels={{ es: pick(dictFor('es')), en: pick(dictFor('en')), [lang]: pick(t) }} />
        </>
      )}
    </main>
  );
}
