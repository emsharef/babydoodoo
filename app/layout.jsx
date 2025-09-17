import ClientProviders from '@/components/ClientProviders';
import NavBar from '@/components/NavBar';

export const metadata = { title: 'BabyDooDoo', description: 'Minimal baby event tracker' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', background: '#f7f7fb', color: '#222' }}>
        <ClientProviders>
          <div style={{ maxWidth: 860, margin: '24px auto', padding: '0 16px', display: 'grid', gap: 16 }}>
            <header style={{ display: 'grid', gap: 8 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <h1 style={{ margin: 0, fontSize: 22 }}>🍼 BabyDooDoo</h1>
                <small style={{ opacity: 0.6 }}>minimal</small>
              </div>
              <NavBar />
            </header>
            <main style={{ display: 'grid', gap: 16 }}>{children}</main>
            <footer style={{ opacity: 0.6, fontSize: 12 }}>RLS + RPC • built for local testing</footer>
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
