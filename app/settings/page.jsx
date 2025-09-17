'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function Button({ children, onClick, style, type }) {
  return (
    <button type={type||'button'} onClick={onClick} style={{ padding:'12px 14px', borderRadius:12, background:'#fde2f3', border:'1px solid #f4a6dc', cursor:'pointer', fontSize:15, fontWeight:600, ...style }}>
      {children}
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [babyName, setBabyName] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user||null);
      if (!user) router.replace('/');
    });
  }, [router]);

  async function createBaby() {
    if (!babyName.trim()) return alert('Enter a baby name.');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch('/api/babies', { method: 'POST', headers: { 'content-type':'application/json', authorization:`Bearer ${token}` }, body: JSON.stringify({ name: babyName.trim() }) });
    if (!res.ok) { console.error('createBaby error', await res.json().catch(()=>({}))); alert('Failed to create baby.'); return; }
    const { baby } = await res.json();
    try { localStorage.setItem('bd_selected_baby', baby.id); } catch {}
    setBabyName('');
    // Go to Log page so user can start logging
    router.replace('/');
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  if (!user) return null;

  return (
    <div style={{ display:'grid', gap:16 }}>
      <section style={{ padding:16, border:'1px solid #eee', borderRadius:12, background:'#fff', display:'grid', gap:8 }}>
        <h2 style={{ marginTop:0 }}>Account</h2>
        <div><strong>Email:</strong> {user.email}</div>
        <div><Button onClick={signOut} style={{ background:'#ffd4d4', border:'1px solid #ff9c9c' }}>Sign out</Button></div>
      </section>
      <section style={{ padding:16, border:'1px solid #eee', borderRadius:12, background:'#fff', display:'grid', gap:8 }}>
        <h2 style={{ marginTop:0 }}>Babies</h2>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input value={babyName} onChange={(e)=>setBabyName(e.target.value)} placeholder="New baby name" style={{ padding:'10px 12px', borderRadius:10, border:'1px solid #ccc', minWidth:240 }} />
          <Button onClick={createBaby}>Create</Button>
        </div>
        <small style={{ color:'#777' }}>Tip: Use the Share page to invite caregivers.</small>
      </section>
    </div>
  );
}
