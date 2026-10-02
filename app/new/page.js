import { createExpense, readReceipt } from '@/app/actions';
import { getT } from '@/lib/i18n';
import { todayPR } from '@/lib/dates';
import ExpenseForm from '@/components/ExpenseForm';
import Top from '@/components/Top';

export default async function NewExpense() {
  const { t, lang } = await getT();
  return (
    <main className="wrap">
      <Top t={t} lang={lang} back />
      <h1 className="page-title">{t.add}</h1>
      <ExpenseForm action={createExpense} readAction={readReceipt} lang={lang} t={t} today={todayPR()} submitLabel={t.save} />
    </main>
  );
}
