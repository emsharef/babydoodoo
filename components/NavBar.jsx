'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function NavBar() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user || null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);
  if (!user) return null;
  return (
    <nav style={{ display: 'flex', gap: 8, padding: 8, background: '#fff', border: '1px solid #eee', borderRadius: 12 }}>
      <Link href="/" style={linkStyle}>Log</Link>
      <Link href="/share" style={linkStyle}>Share</Link>
      <Link href="/settings" style={linkStyle}>Settings</Link>
    </nav>
  );
}
const linkStyle = { padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e5e5', background: '#fafafa', textDecoration: 'none', color: '#222', fontWeight: 600 };
