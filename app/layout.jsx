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
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
        <style dangerouslySetInnerHTML={{ __html: `
          html, body { max-width: 100vw; overflow-x: hidden; }
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
          }
          @keyframes pulse-soft {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.6; }
          }
          @keyframes fadeSlideIn {
            0% { opacity: 0; transform: translateY(12px) scale(0.95); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
        ` }} />
      </head>
      <body style={{
        fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        background: 'linear-gradient(135deg, #faf5ff 0%, #f0f9ff 50%, #fefce8 100%)',
        color: '#1e293b',
        minHeight: '100vh',
        position: 'relative',
      }}>
        {/* Decorative background elements - hidden on mobile to prevent overflow */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 0,
        }}>
          <div style={{
            position: 'absolute',
            top: '10%',
            left: '5%',
            width: 'min(300px, 40vw)',
            height: 'min(300px, 40vw)',
            background: 'radial-gradient(circle, rgba(251,191,36,0.15) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'pulse-soft 8s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute',
            top: '60%',
            right: '10%',
            width: 'min(250px, 35vw)',
            height: 'min(250px, 35vw)',
            background: 'radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'pulse-soft 10s ease-in-out infinite 2s',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '20%',
            left: '15%',
            width: 'min(200px, 30vw)',
            height: 'min(200px, 30vw)',
            background: 'radial-gradient(circle, rgba(52,211,153,0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'pulse-soft 12s ease-in-out infinite 4s',
          }} />
        </div>
        <ClientProviders>
          <div style={{
            maxWidth: 960,
            margin: '0 auto',
            padding: '24px 16px',
            display: 'grid',
            gap: 20,
            position: 'relative',
            zIndex: 1,
            minWidth: 0,
            overflow: 'hidden',
          }}>
            <header style={{ display: 'grid', gap: 12 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <h1 style={{
                  margin: 0,
                  fontSize: 32,
                  fontFamily: 'Nunito, Inter, sans-serif',
                  fontWeight: 900,
                  letterSpacing: '-0.5px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 50%, #8b5cf6 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span style={{
                    WebkitTextFillColor: 'initial',
                    backgroundClip: 'initial',
                    background: 'none',
                    animation: 'float 3s ease-in-out infinite',
                  }}>👶💩💩</span>
                  <span>BabyDooDoo</span>
                </h1>
              </div>
              <NavBar />
            </header>
            <main style={{ display: 'grid', gap: 20 }}>{children}</main>
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
