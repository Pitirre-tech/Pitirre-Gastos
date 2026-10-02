import { db } from '@/lib/db';
import { getT } from '@/lib/i18n';
import { todayPR } from '@/lib/dates';
import { createTrip } from '@/app/trip-actions';
import TripForm from '@/components/TripForm';
import Top from '@/components/Top';

export const dynamic = 'force-dynamic';

export default async function NewTrip() {
  const { t, lang } = await getT();
  const sql = db();
  const [recent, [last]] = await Promise.all([
    sql`select * from (
          select distinct on (lower(start_place), lower(end_place), lower(purpose))
                 start_place, end_place, purpose, client_project, vehicle, round_trip,
                 (case when round_trip and odometer_start is null then miles / 2 else miles end)::float as oneway, trip_date, id
          from trips where deleted_at is null
          order by lower(start_place), lower(end_place), lower(purpose), trip_date desc, id desc) x
        order by trip_date desc, id desc limit 6`,
    sql`select vehicle from trips where vehicle is not null order by id desc limit 1`,
  ]);
  return (
    <main className="wrap">
      <Top t={t} lang={lang} back="/trips" />
      <h1 className="page-title">{t.addTrip}</h1>
      <TripForm action={createTrip} t={t} today={todayPR()} recent={recent.map(({ trip_date, id, ...r }) => r)}
        lastVehicle={last?.vehicle} submitLabel={t.saveTrip} />
    </main>
  );
}
