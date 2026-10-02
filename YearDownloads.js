'use client';
import { useState } from 'react';

const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]);

export default function YearDownloads({ year, files, defaultLang, labels }) {
  const [lang, setLang] = useState(defaultLang);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const L = labels[lang];

  async function downloadPackage() {
    setBusy(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const root = zip.folder(`Pitirre-Tech-${year}`);
      const wb = await fetch(`/api/yearend?y=${year}&lang=${lang}`);
      if (!wb.ok) throw new Error('workbook');
      root.file(`Pitirre-Tech-${L.wbName}-${year}.xlsx`, await wb.blob());

      const folder = root.folder(L.receiptsFolder);
      const failed = [];
      let done = 0;
      setStatus(fill(labels[defaultLang].building, { done, n: files.length }));
      const queue = [...files];
      async function worker() {
        while (queue.length) {
          const f = queue.shift();
          try {
            const res = await fetch(f.url);
            if (!res.ok) throw new Error(String(res.status));
            folder.file(f.file, await res.blob());
          } catch {
            failed.push(f);
          }
          done++;
          setStatus(fill(labels[defaultLang].building, { done, n: files.length }));
        }
      }
      await Promise.all([worker(), worker(), worker(), worker()]);
      if (failed.length) {
        root.file('LEEME-recibos-faltantes-MISSING-receipts.txt', failed.map((f) => `${f.file}\n  ${f.url}`).join('\n\n'));
      }
      setStatus(labels[defaultLang].zipping);
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Pitirre-Tech-${L.wbName}-${year}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      setStatus(failed.length ? fill(labels[defaultLang].someFailed, { n: failed.length }) : labels[defaultLang].doneMsg);
    } catch {
      setStatus(labels[defaultLang].failed);
    }
    setBusy(false);
  }

  const T = labels[defaultLang];
  return (
    <div className="downloads">
      <label className="field">
        <span>{T.wbLang}</span>
        <select value={lang} onChange={(e) => setLang(e.target.value)} disabled={busy}>
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </label>
      <button className="primary" onClick={downloadPackage} disabled={busy}>{T.downloadPackage}</button>
      <a className="secondary" href={`/api/yearend?y=${year}&lang=${lang}`}>{T.downloadExcel}</a>
      {status && <p className="note" role="status">{status}</p>}
      {files.length > 40 && <p className="hint">{T.bigHint}</p>}
    </div>
  );
}
