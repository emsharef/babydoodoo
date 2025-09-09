'use client';

export default function DebugPage() {
  const urlPresent = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const keyPresent = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const redirectPath = process.env.NEXT_PUBLIC_AUTH_REDIRECT_PATH || '/auth/callback';

  return (
    <div style={{ padding: 24 }}>
      <h1>Debug</h1>
      <ul>
        <li>NEXT_PUBLIC_SUPABASE_URL present: <strong>{String(urlPresent)}</strong></li>
        <li>NEXT_PUBLIC_SUPABASE_ANON_KEY present: <strong>{String(keyPresent)}</strong></li>
        <li>NEXT_PUBLIC_AUTH_REDIRECT_PATH: <code>{redirectPath}</code></li>
      </ul>
      <p><em>If any show "false", fix your .env.local and restart the dev server.</em></p>
    </div>
  );
}
