'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Phone photos are 3–8 MB; shrink to ~300 KB before upload.
async function compress(file) {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
    return blob ? new File([blob], 'receipt.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

export default function ExpenseForm({ action, readAction, t, today, initial, submitLabel, lang }) {
  const router = useRouter();
  const formRef = useRef(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(initial?.receipt_url || null);
  const [isPdf, setIsPdf] = useState(initial?.receipt_url?.endsWith('.pdf') || false);
  const [missing, setMissing] = useState(initial?.receipt_missing || false);
  const [file, setFile] = useState(null);
  const [reading, setReading] = useState(false);
  const [readMsg, setReadMsg] = useState(null);
  const [items, setItems] = useState(initial?.items || []);
  const [receiptData, setReceiptData] = useState(null);
  const [refund, setRefund] = useState((initial?.amount ?? 0) < 0);
  const [dup, setDup] = useState(null);

  const fmt = (n) => (n == null ? '' : new Intl.NumberFormat(lang === 'es' ? 'es-PR' : 'en-US', { style: 'currency', currency: 'USD' }).format(n));
  const abs = (n) => (n == null || n === '' ? '' : Math.abs(Number(n)).toFixed(2));

  function fillFrom(d) {
    const el = formRef.current.elements;
    const set = (name, v) => { if (v != null && v !== '' && el.namedItem(name)) el.namedItem(name).value = v; };
    set('amount', d.total != null ? abs(d.total) : null);
    set('vendor', d.vendor);
    set('spent_on', d.date);
    set('ivu', d.ivu ? abs(d.ivu) : null);
    set('category', d.category);
    set('payment_method', d.payment_method);
    setRefund(Boolean(d.is_refund));
  }

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setIsPdf(f.type === 'application/pdf');
    setPreview(f.type === 'application/pdf' ? f.name : URL.createObjectURL(f));
    setMissing(false);
    setError(null);
    setReadMsg(null);
    setDup(null);
    const small = await compress(f);
    setFile(small);
    if (!readAction) return;
    setReading(true);
    try {
      const fd = new FormData();
      fd.set('receipt', small);
      const res = await readAction(fd);
      if (res?.ok) {
        fillFrom(res.data);
        setItems(res.data.items || []);
        setReceiptData(res.data);
        setReadMsg('readDone');
      } else setReadMsg(res?.error || 'readFailed');
    } catch {
      setReadMsg('readFailed');
    }
    setReading(false);
  }

  function submit(confirmDup) {
    const fd = new FormData(formRef.current);
    if (file) fd.set('receipt', file); else fd.delete('receipt');
    if (confirmDup) fd.set('confirm_dup', '1');
    setError(null);
    start(async () => {
      const res = await action(fd);
      if (res?.duplicate) return setDup(res.duplicate);
      if (res?.error) return setError(res.error);
      router.push('/');
      router.refresh();
    });
  }

  const hasReceipt = Boolean(preview);

  return (
    <form ref={formRef} className="form" onSubmit={(e) => { e.preventDefault(); submit(false); }} noValidate>
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="receipt_data" value={receiptData ? JSON.stringify(receiptData) : ''} />

      <label className={`drop ${hasReceipt ? 'has' : ''} ${missing ? 'off' : ''} ${reading ? 'busy' : ''}`}>
        {hasReceipt && !isPdf && <img src={preview} alt={t.receipt} />}
        {hasReceipt && isPdf && <span className="pdf">PDF<small>{preview.split('/').pop()}</small></span>}
        <span className="drop-text">{reading ? t.reading : hasReceipt ? t.receiptChange : t.receiptHint}</span>
        <input type="file" name="receipt" accept="image/*,application/pdf" onChange={onFile} />
      </label>

      {readMsg && <p className={readMsg === 'readDone' ? 'note' : 'error'} role="status">{t[readMsg]}</p>}

      {!hasReceipt && (
        <label className="check">
          <input type="checkbox" name="receipt_missing" checked={missing} onChange={(e) => setMissing(e.target.checked)} />
          {t.receiptMissing}
        </label>
      )}

      <label className={`field amount ${refund ? 'is-refund' : ''}`}>
        <span>{refund ? t.refundAmount : t.amount}</span>
        <div className="money-in">
          <i>{refund ? '−$' : '$'}</i>
          <input name="amount" inputMode="decimal" placeholder="0.00" defaultValue={abs(initial?.amount)} required />
        </div>
      </label>
      <label className="check">
        <input type="checkbox" name="refund" checked={refund} onChange={(e) => setRefund(e.target.checked)} />
        {t.refund}
      </label>

      <label className="field">
        <span>{t.vendor}</span>
        <input name="vendor" placeholder={t.vendorPh} defaultValue={initial?.vendor ?? ''} autoComplete="off" required />
      </label>

      <div className="pair">
        <label className="field">
          <span>{t.date}</span>
          <input type="date" name="spent_on" defaultValue={initial?.spent_on ?? today} required />
        </label>
        <label className="field">
          <span>{t.ivu} <em>{t.optional}</em></span>
          <input name="ivu" inputMode="decimal" placeholder="0.00" defaultValue={initial?.ivu ? abs(initial.ivu) : ''} />
        </label>
      </div>

      <div className="pair">
        <label className="field">
          <span>{t.category}</span>
          <select name="category" defaultValue={initial?.category ?? 'software'}>
            {Object.entries(t.cat).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{t.method}</span>
          <select name="payment_method" defaultValue={initial?.payment_method ?? 'card'}>
            {Object.entries(t.pay).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>

      <div className="pair">
        <label className="field">
          <span>{t.businessPct}</span>
          <div className="pct-in">
            <input name="business_pct" type="number" inputMode="numeric" min="1" max="100" step="1" defaultValue={initial?.business_pct ?? 100} />
            <i>%</i>
          </div>
        </label>
        <p className="field-hint">{t.businessHint}</p>
      </div>

      <label className="field">
        <span>{t.project} <em>{t.optional}</em></span>
        <input name="client_project" defaultValue={initial?.client_project ?? ''} />
      </label>

      <label className="field">
        <span>{t.notes} <em>{t.optional}</em></span>
        <textarea name="notes" rows={2} defaultValue={initial?.notes ?? ''} />
      </label>

      {items.length > 0 && (
        <section className="items" aria-label={t.items}>
          <h2>{t.items} <span>{items.length}</span></h2>
          <ul>
            {items.map((it, i) => (
              <li key={i}>
                <span className="it-desc">
                  {it.description}
                  {it.qty != null && it.qty !== 1 && <small>{it.qty} × {fmt(it.unit_price)}</small>}
                </span>
                <span className="it-amt">{fmt(it.total)}</span>
                <button type="button" className="it-x" aria-label={`${t.remove}: ${it.description}`}
                  onClick={() => setItems(items.filter((_, j) => j !== i))}>×</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dup && (
        <div className="dup" role="alert">
          <p>{t.dupTitle}</p>
          <p className="dup-what">{dup.ref}, {dup.spent_on}, {dup.vendor}, {fmt(dup.amount)}</p>
          <div className="dup-actions">
            <Link href={`/e/${dup.id}`}>{t.openExisting}</Link>
            <button type="button" className="chip" onClick={() => submit(true)} disabled={pending}>{t.saveAnyway}</button>
          </div>
        </div>
      )}

      {error && <p className="error" role="alert">{t[error] || t.failed}</p>}

      <button className="primary" disabled={pending || reading}>{pending ? t.saving : submitLabel}</button>
    </form>
  );
}

export function ConfirmButton({ action, label, confirmText, className = 'danger' }) {
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(confirmText)) e.preventDefault(); }}>
      <button className={className}>{label}</button>
    </form>
  );
}
