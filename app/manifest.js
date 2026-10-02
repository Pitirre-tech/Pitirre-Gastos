export default function manifest() {
  return {
    name: 'Pitirre Tech · Gastos',
    short_name: 'Gastos',
    start_url: '/',
    display: 'standalone',
    background_color: '#EEF1F3',
    theme_color: '#EEF1F3',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
