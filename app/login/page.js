import { login } from '@/app/actions';
import { getT } from '@/lib/i18n';
import Top from '@/components/Top';

export default async function Login({ searchParams }) {
  const { e } = await searchParams;
  const { t, lang } = await getT();
  return (
    <main className="wrap login">
      <Top t={t} lang={lang} back={false} />
      <form action={login} className="form login-form">
        <h1>{t.brand}</h1>
        <label className="field">
          <span>{t.pin}</span>
          <input name="pin" type="password" inputMode="numeric" autoComplete="current-password" autoFocus required />
        </label>
        {e && <p className="error" role="alert">{e === 'locked' ? t.locked : t.wrongPin}</p>}
        <button className="primary">{t.login}</button>
      </form>
    </main>
  );
}
