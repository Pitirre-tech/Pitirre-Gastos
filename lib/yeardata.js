import { db } from './db';
import { withRefs } from './refs';

export async function getYear(year) {
  const start = `${year}-01-01`, end = `${Number(year) + 1}-01-01`;
  const sql = db();
  const [rows, items, trips, readings] = await Promise.all([
    sql`select id, ref, to_char(spent_on,'YYYY-MM-DD') as spent_on, vendor, category, amount::float as amount, ivu::float as ivu, business_pct,
               payment_method, client_project, notes, receipt_url,
               receipt_data->>'card_last4' as card_last4, receipt_data->>'receipt_number' as receipt_number
        from expenses where deleted_at is null and spent_on >= ${start} and spent_on < ${end} order by spent_on, id`,
    sql`select i.expense_id, i.description, i.qty::float as qty, i.unit_price::float as unit_price, i.total::float as total
        from expense_items i join expenses e on e.id = i.expense_id
        where e.deleted_at is null and e.spent_on >= ${start} and e.spent_on < ${end} order by e.spent_on, e.id, i.id`,
    sql`select to_char(trip_date,'YYYY-MM-DD') as trip_date, vehicle, start_place, end_place, purpose, client_project,
               odometer_start::float as odometer_start, odometer_end::float as odometer_end, miles::float as miles, round_trip, notes
        from trips where deleted_at is null and trip_date >= ${start} and trip_date < ${end} order by trip_date, id`,
    sql`select to_char(read_on,'YYYY-MM-DD') as read_on, vehicle, reading::float as reading, note
        from odometer_readings where read_on >= ${start} and read_on < ${end} order by read_on, id`,
  ]);
  return { rows: withRefs(rows, year), items, trips, readings };
}
