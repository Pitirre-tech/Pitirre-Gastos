import Link from 'next/link';
import { logout, setLang } from '@/app/actions';

export default function Top({ t, lang, back }) {
  return (
    <header className="top">
      {back ? <Link href={typeof back === 'string' ? back : '/'} className="back">‹ {t.back}</Link> : <p className="brand">{t.brand}</p>}
      <div className="top-actions">
        <form action={setLang.bind(null, lang === 'es' ? 'en' : 'es')}>
          <button className="chip" aria-label="Language / Idioma">{lang === 'es' ? 'EN' : 'ES'}</button>
        </form>
        {!back && <form action={logout}><button className="chip">{t.logout}</button></form>}
      </div>
    </header>
  );
}
