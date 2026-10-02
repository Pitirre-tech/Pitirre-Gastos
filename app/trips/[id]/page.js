import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getT } from '@/lib/i18n';
import { todayPR } from '@/lib/dates';
import { updateTrip, trashTrip } from '@/app/trip-actions';
import TripForm from '@/components/TripForm';
import { ConfirmButton } from '@/components/ExpenseForm';
import Top from '@/components/Top';

export const dynamic = 'force-dynamic';

export default async function EditTrip({ params }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const { t, lang } = await getT();
  const [row] = await db()`
    select id, to_char(trip_date,'YYYY-MM-DD') as trip_date, vehicle, start_place, end_place, purpose, client_project,
           odometer_start::float as odometer_start, odometer_end::float as odometer_end, miles::float as miles, round_trip, notes
    from trips where id = ${id} and deleted_at is null`;
  if (!row) notFound();
  return (
    <main className="wrap">
      <Top t={t} lang={lang} back="/trips" />
      <h1 className="page-title">{row.start_place} → {row.end_place}</h1>
      <TripForm action={updateTrip.bind(null, id)} t={t} today={todayPR()} initial={row} submitLabel={t.saveChanges} />
      <ConfirmButton action={trashTrip.bind(null, id)} label={t.delTrip} confirmText={t.confirmDelTrip} />
    </main>
  );
}
