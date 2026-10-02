import { db } from './db';
import { withRefs } from './refs';

export async function getYear(year) {
  const start = `${year}-01-01`, end = `${Number(year) + 1}-01-01`;
  const sql = db();
  const [rows, items] = await Promise.all([
    sql`select id, ref, to_char(spent_on,'YYYY-MM-DD') as spent_on, vendor, category, amount::float as amount, ivu::float as ivu, business_pct,
               payment_method, client_project, notes, receipt_url,
               receipt_data->>'card_last4' as card_last4, receipt_data->>'receipt_number' as receipt_number
        from expenses where deleted_at is null and spent_on >= ${start} and spent_on < ${end} order by spent_on, id`,
    sql`select i.expense_id, i.description, i.qty::float as qty, i.unit_price::float as unit_price, i.total::float as total
        from expense_items i join expenses e on e.id = i.expense_id
        where e.deleted_at is null and e.spent_on >= ${start} and e.spent_on < ${end} order by e.spent_on, e.id, i.id`,
  ]);
  return { rows: withRefs(rows, year), items };
}
