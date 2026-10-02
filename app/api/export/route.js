import { db } from '@/lib/db';
import { getT } from '@/lib/i18n';
import { monthRange } from '@/lib/dates';

const esc = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const m = p.get('m'), y = p.get('y');
  let start, end, name;
  if (/^\d{4}-\d{2}$/.test(m || '')) ({ start, end } = monthRange(m)), (name = m);
  else if (/^\d{4}$/.test(y || '')) (start = `${y}-01-01`), (end = `${Number(y) + 1}-01-01`), (name = y);
  else return new Response('Use ?m=YYYY-MM or ?y=YYYY', { status: 400 });

  const { t, lang } = await getT();
  const disp = (n) => ({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="pitirre-gastos-${n}.csv"` });

  if (p.get('items') === '1') {
    const items = await db()`
      select to_char(e.spent_on,'YYYY-MM-DD') as spent_on, e.vendor, e.category, i.description, i.qty, i.unit_price, i.total, e.id
      from expense_items i join expenses e on e.id = i.expense_id
      where e.deleted_at is null and e.spent_on >= ${start} and e.spent_on < ${end} order by e.spent_on, e.id, i.id`;
    const h = lang === 'es'
      ? ['Fecha', 'Pagado a', 'Categoría', 'Artículo', 'Cantidad', 'Precio unitario', 'Total', 'Gasto #']
      : ['Date', 'Paid to', 'Category', 'Item', 'Qty', 'Unit price', 'Total', 'Expense #'];
    const out = [h, ...items.map((r) => [r.spent_on, r.vendor, t.cat[r.category] || r.category, r.description, r.qty, r.unit_price, r.total, r.id])]
      .map((l) => l.map(esc).join(','));
    return new Response('\uFEFF' + out.join('\r\n'), { headers: disp(`${name}-items`) });
  }
  const rows = await db()`
    select to_char(spent_on,'YYYY-MM-DD') as spent_on, vendor, category, amount, ivu, payment_method,
           client_project, notes, receipt_url
    from expenses where deleted_at is null and spent_on >= ${start} and spent_on < ${end} order by spent_on, id`;

  const head = lang === 'es'
    ? ['Fecha', 'Pagado a', 'Categoría', 'Total', 'IVU', 'Pagado con', 'Cliente/proyecto', 'Notas', 'Recibo']
    : ['Date', 'Paid to', 'Category', 'Total', 'IVU', 'Paid with', 'Client/project', 'Notes', 'Receipt'];
  const lines = [head, ...rows.map((r) => [
    r.spent_on, r.vendor, t.cat[r.category] || r.category, r.amount, r.ivu,
    t.pay[r.payment_method] || r.payment_method, r.client_project, r.notes, r.receipt_url || t.noReceipt,
  ])].map((l) => l.map(esc).join(','));

  return new Response('\uFEFF' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pitirre-gastos-${name}.csv"`,
    },
  });
}
