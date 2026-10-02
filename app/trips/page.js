import Link from 'next/link';
import { db } from '@/lib/db';
import { getT, fill } from '@/lib/i18n';
import { todayPR, shortDate, monthLabel } from '@/lib/dates';
import { addReading, deleteReading } from '@/app/trip-actions';
import Top from '@/components/Top';

export const dynamic = 'force-dynamic';
const mi = (n, lang) => new Intl.NumberFormat(lang === 'es' ? 'es-PR' : 'en-US', { maximumFractionDigits: 1 }).format(Number(n) || 0);

export default async function Trips({ searchParams }) {
  const sp = await searchParams;
  const { t, lang } = await getT();
  const today = todayPR();
  const year = /^\d{4}$/.test(sp.y || '') ? sp.y : today.slice(0, 4);
  const start = `${year}-01-01`, end = `${Number(year) + 1}-01-01`;
  const sql = db();
  const [trips, readings, [last]] = await Promise.all([
    sql`select id, to_char(trip_date,'YYYY-MM-DD') as trip_date, start_place, end_place, purpose, miles::float as miles, round_trip
        from trips where deleted_at is null and trip_date >= ${start} and trip_date < ${end} order by trip_date desc, id desc`,
    sql`select id, to_char(read_on,'YYYY-MM-DD') as read_on, vehicle, reading::float as reading, note
        from odometer_readings where read_on >= ${start} and read_on < ${end} order by read_on, id`,
    sql`select vehicle from trips where vehicle is not null order by id desc limit 1`,
  ]);

  const total = trips.reduce((a, r) => a + r.miles, 0);
  const byMonth = new Map();
  for (const r of trips) {
    const m = r.trip_date.slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m).push(r);
  }
  const hasJan = readings.some((r) => r.read_on.slice(5, 7) === '01');
  const hasDec = readings.some((r) => r.read_on.slice(5, 7) === '12');
  const yearOver = today.slice(0, 4) > year || today.slice(5, 7) === '12';
  const driven = readings.length >= 2 ? readings[readings.length - 1].reading - readings[0].reading : null;

  return (
    <main className="wrap">
      <Top t={t} lang={lang} back />
      <nav className="month">
        <Link href={`/trips?y=${Number(year) - 1}`} aria-label={t.prevYear}>‹</Link>
        <h1>{fill(t.mileageTitle, { y: year })}</h1>
        <Link href={`/trips?y=${Number(year) + 1}`} aria-label={t.nextYear}>›</Link>
      </nav>

      <section className="sum">
        <p className="big">{mi(total, lang)} <span className="unit">{t.milesUnit}</span></p>
        <p className="meta">{fill(t.tripCount, { n: trips.length })}
          {driven > 0 && <>, {fill(t.businessShare, { p: (() => { const v = (total / driven) * 100; return v < 10 ? v.toFixed(1) : Math.round(v); })() })}</>}
        </p>
      </section>

      {(!hasJan || (yearOver && !hasDec)) && (
        <p className="warn-box">{!hasJan ? t.odoNeedStart : t.odoNeedEnd} <a href="#odometer">{t.odoAdd}</a></p>
      )}

      {trips.length === 0 && <p className="empty">{t.noTrips}</p>}
      {[...byMonth.entries()].map(([m, rows]) => (
        <section key={m} className="trip-month">
          <h2>{monthLabel(m, lang)} <span>{mi(rows.reduce((a, r) => a + r.miles, 0), lang)} {t.milesUnit}</span></h2>
          <div className="list">
            {rows.map((r) => (
              <Link key={r.id} href={`/trips/${r.id}`} className="row trip-row">
                <span className="row-main">
                  <span className="row-vendor">{r.start_place} → {r.end_place}</span>
                  <span className="row-sub">{shortDate(r.trip_date, lang)}, {r.purpose}{r.round_trip ? `, ${t.roundTripShort}` : ''}</span>
                </span>
                <span className="row-amt">{mi(r.miles, lang)} mi</span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section id="odometer" className="odo">
        <h2>{t.odoTitle}</h2>
        <p className="intro">{t.odoIntro}</p>
        {sp.odo === 'bad' && <p className="error">{t.odoBad}</p>}
        {readings.length > 0 && (
          <ul className="odo-list">
            {readings.map((r) => (
              <li key={r.id}>
                <span>{shortDate(r.read_on, lang)}{r.vehicle ? `, ${r.vehicle}` : ''}{r.note ? `, ${r.note}` : ''}</span>
                <b>{mi(r.reading, lang)}</b>
                <form action={deleteReading.bind(null, r.id, year)}><button className="it-x" aria-label={t.remove}>×</button></form>
              </li>
            ))}
          </ul>
        )}
        <form action={addReading} className="odo-form">
          <input type="date" name="read_on" defaultValue={today.slice(0, 4) === year ? today : `${year}-12-31`} aria-label={t.date} required />
          <input name="reading" inputMode="decimal" placeholder={t.odoReading} aria-label={t.odoReading} required />
          <input name="vehicle" defaultValue={last?.vehicle || ''} placeholder={t.vehicle} aria-label={t.vehicle} />
          <input name="note" placeholder={t.odoNotePh} aria-label={t.notes} />
          <button className="chip">{t.odoAdd}</button>
        </form>
      </section>

      <Link href="/trips/new" className="fab">+ {t.addTrip}</Link>
    </main>
  );
}
