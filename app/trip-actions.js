'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

async function requireAuth() {
  const ok = await verifyToken((await cookies()).get('session')?.value);
  if (!ok) redirect('/login');
}

const num = (v) => {
  const s = String(v ?? '').replace(/[,\s]/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : NaN;
};
const txt = (v, max = 200) => String(v ?? '').trim().slice(0, max) || null;

function parseTrip(fd) {
  const odoStart = num(fd.get('odometer_start'));
  const odoEnd = num(fd.get('odometer_end'));
  const useOdo = fd.get('use_odometer') === 'on';
  const roundTrip = fd.get('round_trip') === 'on';
  let miles;
  if (useOdo) miles = odoStart != null && odoEnd != null ? Math.round((odoEnd - odoStart) * 10) / 10 : NaN;
  else {
    const oneWay = num(fd.get('miles'));
    miles = oneWay == null || Number.isNaN(oneWay) ? NaN : Math.round(oneWay * (roundTrip ? 2 : 1) * 10) / 10;
  }
  return {
    trip_date: String(fd.get('trip_date') || ''),
    vehicle: txt(fd.get('vehicle'), 80),
    start_place: txt(fd.get('start_place')),
    end_place: txt(fd.get('end_place')),
    purpose: txt(fd.get('purpose'), 300),
    client_project: txt(fd.get('client_project')),
    notes: txt(fd.get('notes'), 1000),
    odometer_start: useOdo ? odoStart : null,
    odometer_end: useOdo ? odoEnd : null,
    round_trip: useOdo ? false : roundTrip,
    miles,
    useOdo,
  };
}

function validateTrip(t) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.trip_date)) return 'needDate';
  if (!t.start_place || !t.end_place) return 'tripNeedPlaces';
  if (!t.purpose) return 'tripNeedPurpose';
  if (t.useOdo && (t.odometer_start == null || t.odometer_end == null || Number.isNaN(t.odometer_start) || Number.isNaN(t.odometer_end))) return 'tripNeedOdo';
  if (t.useOdo && t.odometer_end <= t.odometer_start) return 'tripOdoOrder';
  if (!(t.miles > 0)) return 'tripNeedMiles';
  if (t.miles > 1500) return 'tripTooFar';
  return null;
}

export async function createTrip(fd) {
  await requireAuth();
  const t = parseTrip(fd);
  const err = validateTrip(t);
  if (err) return { error: err };
  try {
    const sql = db();
    const [row] = await sql`
      insert into trips (trip_date, vehicle, start_place, end_place, purpose, client_project, odometer_start, odometer_end, miles, round_trip, notes)
      values (${t.trip_date}, ${t.vehicle}, ${t.start_place}, ${t.end_place}, ${t.purpose}, ${t.client_project},
              ${t.odometer_start}, ${t.odometer_end}, ${t.miles}, ${t.round_trip}, ${t.notes})
      returning id`;
    await sql`insert into expense_log (expense_id, action, detail) values (null, 'trip-created', ${`trip ${row.id}: ${t.start_place} → ${t.end_place}, ${t.miles} mi`})`;
  } catch (x) {
    console.error(x);
    return { error: 'failed' };
  }
  revalidatePath('/trips');
  return { ok: true };
}

export async function updateTrip(id, fd) {
  await requireAuth();
  const t = parseTrip(fd);
  const err = validateTrip(t);
  if (err) return { error: err };
  try {
    const sql = db();
    await sql`
      update trips set trip_date = ${t.trip_date}, vehicle = ${t.vehicle}, start_place = ${t.start_place}, end_place = ${t.end_place},
        purpose = ${t.purpose}, client_project = ${t.client_project}, odometer_start = ${t.odometer_start},
        odometer_end = ${t.odometer_end}, miles = ${t.miles}, round_trip = ${t.round_trip}, notes = ${t.notes}, updated_at = now()
      where id = ${id} and deleted_at is null`;
    await sql`insert into expense_log (expense_id, action, detail) values (null, 'trip-edited', ${`trip ${id}: ${t.miles} mi`})`;
  } catch (x) {
    console.error(x);
    return { error: 'failed' };
  }
  revalidatePath('/trips');
  return { ok: true };
}

export async function trashTrip(id) {
  await requireAuth();
  await db()`update trips set deleted_at = now() where id = ${id} and deleted_at is null`;
  revalidatePath('/trips');
  redirect('/trips');
}

export async function restoreTrip(id) {
  await requireAuth();
  await db()`update trips set deleted_at = null where id = ${id}`;
  revalidatePath('/trips');
  revalidatePath('/trash');
}

export async function purgeTrip(id) {
  await requireAuth();
  await db()`delete from trips where id = ${id} and deleted_at is not null`;
  revalidatePath('/trash');
}

export async function addReading(fd) {
  await requireAuth();
  const read_on = String(fd.get('read_on') || '');
  const reading = num(fd.get('reading'));
  const year = /^\d{4}/.test(read_on) ? read_on.slice(0, 4) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(read_on) || reading == null || Number.isNaN(reading) || reading < 0) {
    redirect(`/trips?y=${year || new Date().getFullYear()}&odo=bad#odometer`);
  }
  await db()`insert into odometer_readings (read_on, vehicle, reading, note)
             values (${read_on}, ${txt(fd.get('vehicle'), 80)}, ${reading}, ${txt(fd.get('note'), 200)})`;
  revalidatePath('/trips');
  redirect(`/trips?y=${year}#odometer`);
}

export async function deleteReading(id, year) {
  await requireAuth();
  await db()`delete from odometer_readings where id = ${id}`;
  revalidatePath('/trips');
  redirect(`/trips?y=${year}#odometer`);
}
