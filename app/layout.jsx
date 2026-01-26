import ClientProviders from '@/components/ClientProviders';
import NavBar from '@/components/NavBar';

export const metadata = {
  title: 'BabyDooDoo',
  description: 'Baby & pregnancy event tracker',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BabyDooDoo',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800&family=Inter:wght@400;600&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
      </head>
      <body style={{ fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif', background: '#f7f7fb', color: '#222' }}>
        <ClientProviders>
          <div style={{ maxWidth: 960, margin: '24px auto', padding: '0 16px', display: 'grid', gap: 16 }}>
            <header style={{ display: 'grid', gap: 8 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <h1 style={{ margin: 0, fontSize: 28, fontFamily:'Nunito, Inter, sans-serif', letterSpacing: '.3px' }}>👶💩💩 BabyDooDoo</h1>
              </div>
              <NavBar />
            </header>
            <main style={{ display: 'grid', gap: 16 }}>{children}</main>
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
