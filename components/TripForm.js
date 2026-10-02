'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function TripForm({ action, t, today, initial, recent = [], lastVehicle, submitLabel }) {
  const router = useRouter();
  const formRef = useRef(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState(null);
  const [useOdo, setUseOdo] = useState(initial?.odometer_start != null);
  const [roundTrip, setRoundTrip] = useState(initial?.round_trip || false);
  const oneWayInit = initial && initial.odometer_start == null
    ? (initial.round_trip ? initial.miles / 2 : initial.miles) : '';
  const [oneWay, setOneWay] = useState(oneWayInit === '' ? '' : String(oneWayInit));
  const [odoS, setOdoS] = useState(initial?.odometer_start ?? '');
  const [odoE, setOdoE] = useState(initial?.odometer_end ?? '');

  const total = useOdo
    ? (Number(odoE) > Number(odoS) && odoS !== '' ? Math.round((Number(odoE) - Number(odoS)) * 10) / 10 : null)
    : (Number(oneWay) > 0 ? Math.round(Number(oneWay) * (roundTrip ? 2 : 1) * 10) / 10 : null);

  function repeat(r) {
    const el = formRef.current.elements;
    for (const k of ['start_place', 'end_place', 'purpose', 'client_project', 'vehicle']) {
      if (el.namedItem(k)) el.namedItem(k).value = r[k] ?? '';
    }
    setUseOdo(false);
    setRoundTrip(Boolean(r.round_trip));
    setOneWay(String(r.oneway));
  }

  function onSubmit(e) {
    e.preventDefault();
    const fd = new FormData(formRef.current);
    setError(null);
    start(async () => {
      const res = await action(fd);
      if (res?.error) return setError(res.error);
      router.push('/trips');
      router.refresh();
    });
  }

  return (
    <form ref={formRef} className="form" onSubmit={onSubmit} noValidate>
      {recent.length > 0 && (
        <section className="repeat">
          <h2>{t.repeatTrip}</h2>
          <div className="repeat-list">
            {recent.map((r, i) => (
              <button type="button" key={i} className="repeat-chip" onClick={() => repeat(r)}>
                <b>{r.start_place} → {r.end_place}</b>
                <small>{r.purpose}, {r.round_trip ? r.oneway * 2 : r.oneway} mi</small>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="pair">
        <label className="field">
          <span>{t.date}</span>
          <input type="date" name="trip_date" defaultValue={initial?.trip_date ?? today} required />
        </label>
        <label className="field">
          <span>{t.vehicle} <em>{t.optional}</em></span>
          <input name="vehicle" defaultValue={initial?.vehicle ?? lastVehicle ?? ''} placeholder={t.vehiclePh} />
        </label>
      </div>

      <label className="field">
        <span>{t.from}</span>
        <input name="start_place" defaultValue={initial?.start_place ?? ''} placeholder={t.fromPh} autoComplete="off" required />
      </label>
      <label className="field">
        <span>{t.to}</span>
        <input name="end_place" defaultValue={initial?.end_place ?? ''} placeholder={t.toPh} autoComplete="off" required />
      </label>
      <label className="field">
        <span>{t.purpose}</span>
        <input name="purpose" defaultValue={initial?.purpose ?? ''} placeholder={t.purposePh} required />
      </label>
      <label className="field">
        <span>{t.project} <em>{t.optional}</em></span>
        <input name="client_project" defaultValue={initial?.client_project ?? ''} />
      </label>

      <label className="check">
        <input type="checkbox" name="use_odometer" checked={useOdo} onChange={(e) => setUseOdo(e.target.checked)} />
        {t.useOdo}
      </label>

      {useOdo ? (
        <div className="pair">
          <label className="field">
            <span>{t.odoStart}</span>
            <input name="odometer_start" inputMode="decimal" value={odoS} onChange={(e) => setOdoS(e.target.value)} />
          </label>
          <label className="field">
            <span>{t.odoEnd}</span>
            <input name="odometer_end" inputMode="decimal" value={odoE} onChange={(e) => setOdoE(e.target.value)} />
          </label>
        </div>
      ) : (
        <>
          <label className="field">
            <span>{t.milesOneWay}</span>
            <input name="miles" inputMode="decimal" placeholder="0.0" value={oneWay} onChange={(e) => setOneWay(e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" name="round_trip" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} />
            {t.roundTrip}
          </label>
        </>
      )}

      <p className="miles-total" aria-live="polite">{total != null ? `${total} ${t.milesUnit}` : '— ' + t.milesUnit}</p>

      <label className="field">
        <span>{t.notes} <em>{t.optional}</em></span>
        <textarea name="notes" rows={2} defaultValue={initial?.notes ?? ''} />
      </label>

      {error && <p className="error" role="alert">{t[error] || t.failed}</p>}
      <button className="primary" disabled={pending}>{pending ? t.saving : submitLabel}</button>
    </form>
  );
}
