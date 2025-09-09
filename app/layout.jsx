export const metadata = {
  title: 'BabyDooDoo — Minimal Smoke Test',
  description: 'Auth + Baby + DooDoo with RLS policies.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#fffaf0', color: '#222' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
          <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 28 }}>🍼💩 <strong>BabyDooDoo</strong> <small style={{ marginLeft: 8, fontSize: 14, opacity: 0.7 }}>infra step</small></div>
          </header>
          <main>{children}</main>
          <footer style={{ marginTop: 48, fontSize: 12, opacity: 0.7 }}>
            <p>Local testing build. Do not use in production.</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
