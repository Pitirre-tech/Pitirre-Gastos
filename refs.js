// Shared by the workbook (server) and the receipts ZIP (browser) so names always match.
// Uses the permanent ref stored on each expense; the fallback only covers rows from before refs existed.
const slug = (s) =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'gasto';

export function withRefs(rows, year) {
  return rows.map((r, i) => {
    const ref = r.ref || `${year}-x${String(i + 1).padStart(3, '0')}`;
    const ext = r.receipt_url && r.receipt_url.split('?')[0].toLowerCase().endsWith('.pdf') ? 'pdf' : 'jpg';
    return {
      ...r,
      ref,
      file: r.receipt_url ? `${ref}_${r.spent_on}_${slug(r.vendor)}_${Number(r.amount).toFixed(2)}.${ext}` : null,
    };
  });
}
