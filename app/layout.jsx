export const metadata = { title: 'BabyDooDoo (Minimal)', description: 'Tiny smoke test with sharing' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', background: '#f7f7fb', color: '#222' }}>
        <div style={{ maxWidth: 860, margin: '24px auto', padding: '0 16px', display: 'grid', gap: 16 }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ margin: 0, fontSize: 22 }}>🍼 BabyDooDoo</h1>
            <small style={{ opacity: 0.6 }}>minimal</small>
          </header>
          <main style={{ display: 'grid', gap: 16 }}>{children}</main>
          <footer style={{ opacity: 0.6, fontSize: 12 }}>Built for local testing • RLS + RPC</footer>
        </div>
      </body>
    </html>
  );
}
