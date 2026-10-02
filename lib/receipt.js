import { CATEGORIES, METHODS } from './i18n';

const PROMPT = `You are reading a purchase receipt or invoice for a small business in Puerto Rico. It may be in Spanish or English.
Return ONLY a JSON object, no markdown, in this shape:
{"vendor": string|null, "date": "YYYY-MM-DD"|null, "total": number|null, "ivu": number|null, "is_refund": boolean,
 "payment_method": one of ${JSON.stringify(METHODS)} or null, "category": one of ${JSON.stringify(CATEGORIES)},
 "receipt_number": string|null, "card_last4": string|null,
 "items": [{"description": string, "qty": number|null, "unit_price": number|null, "total": number|null}]}
Rules:
- total = final amount paid, including tax, as a positive number.
- is_refund = true if this is a refund, return, credit or devolución (money back to the buyer); total and ivu stay positive.
- ivu = sum of all IVU / sales tax lines (state + municipal). 0 if none shown.
- payment_method: ATH Móvil -> "ath"; credit card (Visa, Mastercard, Amex) -> "card"; debit -> "debit"; Efectivo/cash -> "cash"; PayPal -> "paypal"; bank transfer -> "transfer".
- category from vendor and items: software = apps, subscriptions, hosting, domains; hardware = equipment, computers, tools;
  marketing = ads, promo; printing = print, vinyl, substrates, ink; contractors = services by people; transport = gas, tolls, parking, rides;
  meals = food; office = supplies; fees = bank or payment fees; education = courses, books; otherwise other.
- items: one entry per purchased line. Skip subtotal, tax, total, tip, change and payment lines. Expand abbreviations when obvious.
- Numbers without $ or commas. Dates as YYYY-MM-DD (receipts in PR usually show MM/DD/YYYY).
- If this is not a receipt or invoice, return {"error":"not_a_receipt"}.`;

const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
};
const str = (v, max = 200) => (v == null ? null : String(v).trim().slice(0, max) || null);

function clean(d) {
  if (!d || d.error) return null;
  return {
    vendor: str(d.vendor),
    date: /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') ? d.date : null,
    total: num(d.total) == null ? null : Math.abs(num(d.total)),
    is_refund: d.is_refund === true,
    ivu: num(d.ivu) == null ? null : Math.abs(num(d.ivu)),
    payment_method: METHODS.includes(d.payment_method) ? d.payment_method : null,
    category: CATEGORIES.includes(d.category) ? d.category : 'other',
    receipt_number: str(d.receipt_number, 60),
    card_last4: /^\d{4}$/.test(d.card_last4 || '') ? d.card_last4 : null,
    items: (Array.isArray(d.items) ? d.items : [])
      .filter((i) => i && str(i.description))
      .slice(0, 150)
      .map((i) => ({ description: str(i.description, 300), qty: num(i.qty), unit_price: num(i.unit_price), total: num(i.total) })),
  };
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Returns cleaned receipt data, null if it isn't a receipt, or throws on API failure.
export async function extractReceipt(file) {
  const data = Buffer.from(await file.arrayBuffer()).toString('base64');
  const block = file.type === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
    : { type: 'image', source: { type: 'base64', media_type: IMAGE_TYPES.includes(file.type) ? file.type : 'image/jpeg', data } };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.RECEIPT_MODEL || 'claude-haiku-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: [block, { type: 'text', text: PROMPT }] }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    let type = '', message = body;
    try { const j = JSON.parse(body); type = j.error?.type || ''; message = j.error?.message || body; } catch {}
    const err = new Error(`Anthropic ${res.status} ${type}: ${message}`);
    err.status = res.status; err.type = type; err.detail = message;
    throw err;
  }
  const json = await res.json();
  const text = (json.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const raw = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return clean(JSON.parse(raw));
}
