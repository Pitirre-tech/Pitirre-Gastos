import { neon } from '@neondatabase/serverless';

// Reads invoices from the Pitirre Hub database (read-only use). Returns null when HUB_DATABASE_URL isn't set.
export async function getIncome(year) {
  if (!process.env.HUB_DATABASE_URL) return null;
  const start = `${year}-01-01`, end = `${Number(year) + 1}-01-01`;
  try {
    const sql = neon(process.env.HUB_DATABASE_URL);
    const rows = await sql`
      SELECT invoice_number, to_char(issued_at,'YYYY-MM-DD') AS issued_at, client_name,
             subtotal::float AS subtotal, tax_amount::float AS tax_amount, total::float AS total, is_deposit, status,
             to_char(paid_at,'YYYY-MM-DD') AS paid_at, amount_received::float AS amount_received,
             coalesce(amount_withheld, 0)::float AS amount_withheld, payment_method, payment_note, void_reason
      FROM invoices
      WHERE doc_type = 'invoice'
        AND ((issued_at >= ${start} AND issued_at < ${end}) OR (paid_at >= ${start} AND paid_at < ${end}))
      ORDER BY issued_at, invoice_number`;
    return { rows };
  } catch (x) {
    console.error('Hub income read failed:', x.message || x);
    return { error: true, rows: [] };
  }
}
