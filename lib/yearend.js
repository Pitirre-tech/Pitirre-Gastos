import ExcelJS from 'exceljs';

const L = {
  es: {
    summary: 'Resumen', expenses: 'Gastos', items: 'Artículos', methods: 'Métodos de pago', missing: 'Sin recibo', projects: 'Clientes y proyectos',
    title: 'gastos del negocio', generated: 'Generado', contact: 'Contacto',
    totalSpent: 'Total gastado (con IVU)', ivuPaid: 'IVU pagado', net: 'Total sin IVU', count: 'Cantidad de gastos', withoutReceipt: 'Gastos sin recibo',
    byCatMonth: 'Porción de negocio por categoría y mes (con IVU)', byMethodMonth: 'Porción de negocio por método de pago y mes (con IVU)',
    bizPct: 'Uso de negocio', bizAmt: 'Porción de negocio', bizTotal: 'Porción de negocio (con IVU)',
    category: 'Categoría', method: 'Método de pago', total: 'Total',
    months: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    ref: 'Ref.', date: 'Fecha', paidTo: 'Pagado a', ivu: 'IVU', netCol: 'Neto sin IVU', paidWith: 'Pagado con', last4: 'Tarjeta (últimos 4)',
    receiptNo: 'Núm. de recibo', project: 'Cliente/proyecto', notes: 'Notas', receipt: 'Recibo', receiptFile: 'Archivo en carpeta Recibos',
    acctNotes: 'Notas del contador', open: 'Ver recibo', none: 'Sin recibo', item: 'Artículo', qty: 'Cantidad', unit: 'Precio unitario',
    expCount: 'Gastos', missingIntro: 'Estos gastos no tienen recibo. Puede servir la línea del estado de cuenta del banco o tarjeta.',
    readme: [
      'Cómo usar este archivo',
      'Cada gasto tiene un número de referencia (Ref.). El archivo del recibo en la carpeta "Recibos" empieza con ese mismo número.',
      'Las cantidades están en dólares (USD) e incluyen el IVU. La columna "Neto sin IVU" lo resta.',
      'Las categorías las asignó el dueño del negocio; ajústelas según la planilla.',
      'Si un gasto fue en parte personal, "Uso de negocio" indica el %; los totales por categoría y mes usan solo la porción de negocio.',
      'Los reembolsos y devoluciones aparecen en negativo y restan de los totales.',
      'Los números de referencia son permanentes. Un número que falta corresponde a un gasto borrado.',
      'La columna amarilla "Notas del contador" en la hoja Gastos es para su uso.',
      'Los totales de este resumen son fórmulas y se actualizan si se edita la hoja Gastos.',
    ],
  },
  en: {
    summary: 'Summary', expenses: 'Expenses', items: 'Items', methods: 'Payment methods', missing: 'Missing receipts', projects: 'Clients and projects',
    title: 'business expenses', generated: 'Generated', contact: 'Contact',
    totalSpent: 'Total spent (incl. IVU)', ivuPaid: 'IVU paid', net: 'Total net of IVU', count: 'Number of expenses', withoutReceipt: 'Expenses without a receipt',
    byCatMonth: 'Business portion by category and month (incl. IVU)', byMethodMonth: 'Business portion by payment method and month (incl. IVU)',
    bizPct: 'Business use', bizAmt: 'Business portion', bizTotal: 'Business portion (incl. IVU)',
    category: 'Category', method: 'Payment method', total: 'Total',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    ref: 'Ref.', date: 'Date', paidTo: 'Paid to', ivu: 'IVU', netCol: 'Net of IVU', paidWith: 'Paid with', last4: 'Card (last 4)',
    receiptNo: 'Receipt no.', project: 'Client/project', notes: 'Notes', receipt: 'Receipt', receiptFile: 'File in Receipts folder',
    acctNotes: 'Accountant notes', open: 'Open receipt', none: 'No receipt', item: 'Item', qty: 'Qty', unit: 'Unit price',
    expCount: 'Expenses', missingIntro: 'These expenses have no receipt. The matching bank or card statement line may serve instead.',
    readme: [
      'How to use this file',
      'Every expense has a reference number (Ref.). Its receipt file in the "Receipts" folder starts with the same number.',
      'Amounts are in US dollars and include IVU. The "Net of IVU" column subtracts it.',
      'Categories were assigned by the business owner; adjust them as needed for the return.',
      'If an expense was partly personal, "Business use" shows the %; the category and month totals use only the business portion.',
      'Refunds and returns appear as negative amounts and reduce the totals.',
      'Reference numbers are permanent. A missing number is an expense that was deleted.',
      'The yellow "Accountant notes" column on the Expenses sheet is for your use.',
      'Totals on this summary are formulas and update if the Expenses sheet is edited.',
    ],
  },
};

const FONT = 'Arial';
const MONEY = '$#,##0.00;($#,##0.00);"-"';
const INK = 'FF17222B', BLUE = 'FF1F5FA8', HEAD_FILL = 'FFE6EBEF', YELLOW = 'FFFFF2CC';

function headerRow(ws, rowNum, values) {
  const row = ws.getRow(rowNum);
  row.values = values;
  row.eachCell((c) => {
    c.font = { name: FONT, bold: true, color: { argb: INK } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } };
    c.alignment = { vertical: 'middle', wrapText: true };
    c.border = { bottom: { style: 'thin', color: { argb: 'FF9AA7B2' } } };
  });
  row.height = 30;
}

function setFont(ws) {
  ws.eachRow((row) => row.eachCell((c) => { c.font = { ...(c.font || {}), name: FONT }; }));
}

// rows: from getYear(), with ref/file. t: app dictionary (category & payment labels).
export async function buildWorkbook({ year, lang, t, rows, items, business = 'Pitirre Tech', email = 'hello@pitirre.tech', categories, methods }) {
  const l = L[lang === 'es' ? 'es' : 'en'];
  const wb = new ExcelJS.Workbook();
  wb.creator = business;
  wb.created = new Date();
  wb.calcProperties = { fullCalcOnLoad: true };

  const S = wb.addWorksheet(l.summary, { views: [{ showGridLines: false }] });
  const E = wb.addWorksheet(l.expenses, { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] });
  const I = wb.addWorksheet(l.items, { views: [{ state: 'frozen', ySplit: 1 }] });
  const M = wb.addWorksheet(l.methods, { views: [{ showGridLines: false }] });
  const P = wb.addWorksheet(l.projects, { views: [{ state: 'frozen', ySplit: 1 }] });
  const X = wb.addWorksheet(l.missing, { views: [{ state: 'frozen', ySplit: 2 }] });
  const ES = `'${l.expenses}'`;

  // ---- Expenses (data) ----
  const eCols = [
    [l.ref, 11], [l.date, 12], [l.paidTo, 26], [l.category, 24], [l.total, 13], [l.ivu, 11], [l.netCol, 13],
    [l.bizPct, 10], [l.bizAmt, 13], [l.paidWith, 17], [l.last4, 11], [l.receiptNo, 14], [l.project, 20], [l.notes, 30], [l.receipt, 13], [l.receiptFile, 44], [l.acctNotes, 30],
  ];
  eCols.forEach(([, w], i) => (E.getColumn(i + 1).width = w));
  headerRow(E, 1, eCols.map(([h]) => h));
  rows.forEach((r, i) => {
    const n = i + 2;
    const [y, m, d] = r.spent_on.split('-').map(Number);
    E.getRow(n).values = [
      r.ref, new Date(Date.UTC(y, m - 1, d)), r.vendor, t.cat[r.category] || r.category, r.amount, r.ivu || 0,
      { formula: `E${n}-F${n}` }, (r.business_pct ?? 100) / 100, { formula: `E${n}*H${n}` }, t.pay[r.payment_method] || r.payment_method, r.card_last4 || '', r.receipt_number || '',
      r.client_project || '', r.notes || '', r.receipt_url ? { text: l.open, hyperlink: r.receipt_url } : l.none, r.file || '', '',
    ];
    E.getCell(`B${n}`).numFmt = 'yyyy-mm-dd';
    ['E', 'F', 'G', 'I'].forEach((c) => (E.getCell(`${c}${n}`).numFmt = MONEY));
    E.getCell(`H${n}`).numFmt = '0%';
    E.getCell(`O${n}`).font = r.receipt_url ? { color: { argb: BLUE }, underline: true } : { color: { argb: 'FFC2362F' }, bold: true };
    E.getCell(`Q${n}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW } };
  });
  E.getCell('Q1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW } };
  if (rows.length) E.autoFilter = { from: 'A1', to: `Q${rows.length + 1}` };
  const last = Math.max(rows.length + 1, 2);
  const col = (c) => `${ES}!$${c}$2:$${c}$${last}`;

  // ---- Summary ----
  S.getColumn(1).width = 30;
  for (let c = 2; c <= 14; c++) S.getColumn(c).width = 11.5;
  S.getCell('A1').value = `${business}: ${l.title} ${year}`;
  S.getCell('A1').font = { bold: true, size: 16, color: { argb: INK } };
  S.getCell('A2').value = `${l.generated} ${new Date().toISOString().slice(0, 10)}   ${l.contact}: ${email}`;
  S.getCell('A2').font = { color: { argb: 'FF5D6B77' } };

  const kpis = [
    [l.totalSpent, `SUM(${col('E')})`, MONEY],
    [l.ivuPaid, `SUM(${col('F')})`, MONEY],
    [l.net, 'B4-B5', MONEY],
    [l.bizTotal, `SUM(${col('I')})`, MONEY],
    [l.count, `COUNTA(${col('A')})`, '0'],
    [l.withoutReceipt, `COUNTIF(${col('O')},"${l.none}")`, '0'],
  ];
  kpis.forEach(([label, f, fmt], i) => {
    const r = 4 + i;
    S.getCell(`A${r}`).value = label;
    S.getCell(`B${r}`).value = { formula: f };
    S.getCell(`B${r}`).numFmt = fmt;
    S.getCell(`B${r}`).font = { bold: true };
    S.mergeCells(`B${r}:C${r}`);
  });

  function grid(ws, top, title, labelHead, labels, matchCol) {
    ws.getCell(`A${top}`).value = title;
    ws.getCell(`A${top}`).font = { bold: true, size: 12 };
    headerRow(ws, top + 1, [labelHead, ...l.months, l.total]);
    labels.forEach((lab, i) => {
      const r = top + 2 + i;
      ws.getCell(`A${r}`).value = lab;
      for (let m = 1; m <= 12; m++) {
        const c = ws.getRow(r).getCell(m + 1);
        c.value = { formula: `SUMIFS(${col('I')},${col(matchCol)},$A${r},${col('B')},">="&DATE(${year},${m},1),${col('B')},"<"&DATE(${year},${m + 1},1))` };
        c.numFmt = MONEY;
      }
      const tc = ws.getRow(r).getCell(14);
      tc.value = { formula: `SUM(B${r}:M${r})` };
      tc.numFmt = MONEY;
      tc.font = { bold: true };
    });
    const tr = top + 2 + labels.length;
    ws.getCell(`A${tr}`).value = l.total;
    for (let c = 2; c <= 14; c++) {
      const cell = ws.getRow(tr).getCell(c);
      const L1 = cell.address.replace(/\d+$/, '');
      cell.value = { formula: `SUM(${L1}${top + 2}:${L1}${tr - 1})` };
      cell.numFmt = MONEY;
    }
    ws.getRow(tr).eachCell((c) => { c.font = { bold: true }; c.border = { top: { style: 'thin' } }; });
    return tr;
  }

  const catLabels = categories.map((k) => t.cat[k] || k);
  const gridEnd = grid(S, 11, l.byCatMonth, l.category, catLabels, 'D');
  l.readme.forEach((line, i) => {
    const c = S.getCell(`A${gridEnd + 3 + i}`);
    c.value = i === 0 ? line : `• ${line}`;
    c.font = i === 0 ? { bold: true, size: 12 } : { color: { argb: 'FF5D6B77' } };
  });

  // ---- Payment methods ----
  M.getColumn(1).width = 24;
  for (let c = 2; c <= 14; c++) M.getColumn(c).width = 11.5;
  grid(M, 1, l.byMethodMonth, l.method, methods.map((k) => t.pay[k] || k), 'J');

  // ---- Items ----
  [[l.ref, 11], [l.date, 12], [l.paidTo, 24], [l.category, 22], [l.item, 44], [l.qty, 9], [l.unit, 13], [l.total, 13]]
    .forEach(([, w], i) => (I.getColumn(i + 1).width = w));
  headerRow(I, 1, [l.ref, l.date, l.paidTo, l.category, l.item, l.qty, l.unit, l.total]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  items.forEach((it, i) => {
    const r = byId.get(it.expense_id);
    if (!r) return;
    const n = i + 2;
    const [y, m, d] = r.spent_on.split('-').map(Number);
    I.getRow(n).values = [r.ref, new Date(Date.UTC(y, m - 1, d)), r.vendor, t.cat[r.category] || r.category, it.description, it.qty, it.unit_price, it.total];
    I.getCell(`B${n}`).numFmt = 'yyyy-mm-dd';
    I.getCell(`G${n}`).numFmt = MONEY;
    I.getCell(`H${n}`).numFmt = MONEY;
  });
  if (items.length) I.autoFilter = { from: 'A1', to: `H${items.length + 1}` };

  // ---- Clients & projects ----
  const projects = [...new Set(rows.map((r) => r.client_project).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  [[l.project, 30], [l.expCount, 11], [l.total, 14], [l.ivu, 12], [l.netCol, 14], [l.bizAmt, 14]].forEach(([, w], i) => (P.getColumn(i + 1).width = w));
  headerRow(P, 1, [l.project, l.expCount, l.total, l.ivu, l.netCol, l.bizAmt]);
  projects.forEach((p, i) => {
    const n = i + 2;
    P.getRow(n).values = [p, { formula: `COUNTIF(${col('M')},A${n})` }, { formula: `SUMIFS(${col('E')},${col('M')},A${n})` },
      { formula: `SUMIFS(${col('F')},${col('M')},A${n})` }, { formula: `C${n}-D${n}` }, { formula: `SUMIFS(${col('I')},${col('M')},A${n})` }];
    ['C', 'D', 'E', 'F'].forEach((c) => (P.getCell(`${c}${n}`).numFmt = MONEY));
  });

  // ---- Missing receipts ----
  [[l.ref, 11], [l.date, 12], [l.paidTo, 26], [l.category, 24], [l.total, 13], [l.paidWith, 17], [l.notes, 40]]
    .forEach(([, w], i) => (X.getColumn(i + 1).width = w));
  X.getCell('A1').value = l.missingIntro;
  X.getCell('A1').font = { italic: true, color: { argb: 'FF5D6B77' } };
  headerRow(X, 2, [l.ref, l.date, l.paidTo, l.category, l.total, l.paidWith, l.notes]);
  rows.filter((r) => !r.receipt_url).forEach((r, i) => {
    const n = i + 3;
    const [y, m, d] = r.spent_on.split('-').map(Number);
    X.getRow(n).values = [r.ref, new Date(Date.UTC(y, m - 1, d)), r.vendor, t.cat[r.category] || r.category, r.amount,
      t.pay[r.payment_method] || r.payment_method, r.notes || ''];
    X.getCell(`B${n}`).numFmt = 'yyyy-mm-dd';
    X.getCell(`E${n}`).numFmt = MONEY;
  });

  [S, E, I, M, P, X].forEach(setFont);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
