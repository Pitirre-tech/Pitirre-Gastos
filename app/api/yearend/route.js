import { dictFor, CATEGORIES, METHODS } from '@/lib/i18n';
import { getYear } from '@/lib/yeardata';
import { buildWorkbook } from '@/lib/yearend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const year = p.get('y');
  if (!/^\d{4}$/.test(year || '')) return new Response('Use ?y=YYYY', { status: 400 });
  const lang = p.get('lang') === 'en' ? 'en' : 'es';
  const t = dictFor(lang);
  const { rows, items, trips, readings } = await getYear(year);
  const buf = await buildWorkbook({
    year, lang, t, rows, items, trips, readings, categories: CATEGORIES, methods: METHODS,
    business: process.env.BUSINESS_NAME || 'Pitirre Tech',
    email: process.env.BUSINESS_EMAIL || 'hello@pitirre.tech',
  });
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Pitirre-Tech-${t.wbName}-${year}.xlsx"`,
    },
  });
}
