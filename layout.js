import './globals.css';
import { cookies } from 'next/headers';

export const metadata = {
  title: 'Pitirre Tech · Gastos',
  appleWebApp: { capable: true, title: 'Gastos', statusBarStyle: 'default' },
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#EEF1F3' };

export default async function RootLayout({ children }) {
  const lang = (await cookies()).get('lang')?.value === 'es' ? 'es' : 'en';
  return (
    <html lang={lang}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
