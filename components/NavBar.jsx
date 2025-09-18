'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useBaby } from './BabyContext';

export default function NavBar() {
  const [user, setUser] = useState(null);
  const { babies, selectedBabyId, selectBaby } = useBaby();
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user || null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);
  if (!user) return null;
  return (
    <nav style={{ display: 'flex', gap: 8, padding: 8, background: '#fff', border: '1px solid #eee', borderRadius: 12, alignItems:'center' }}>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <Link href="/" style={linkStyle}>Log</Link>
        <Link href="/share" style={linkStyle}>Share</Link>
        <Link href="/settings" style={linkStyle}>Settings</Link>
      </div>
      <div style={{ marginLeft: 'auto', display:'flex', gap:8, alignItems:'center' }}>
        <label htmlFor="babySelectTop" style={{ fontSize:12, color:'#666' }}>Baby:</label>
        <select id="babySelectTop" value={selectedBabyId} onChange={(e)=>selectBaby(e.target.value)} style={{ padding:'8px 10px', borderRadius:10, border:'1px solid #ccc' }}>
          <option value="" disabled>Select...</option>
          {babies.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
    </nav>
  );
}
const linkStyle = { padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e5e5', background: '#fafafa', textDecoration: 'none', color: '#222', fontWeight: 600, fontFamily: 'Inter, system-ui, sans-serif' };
