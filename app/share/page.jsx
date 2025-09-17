'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function Button({ children, onClick, style, type }) {
  return (
    <button type={type||'button'} onClick={onClick} style={{ padding:'12px 14px', borderRadius:12, background:'#e8f0ff', border:'1px solid #9db8ff', cursor:'pointer', fontSize:15, fontWeight:600, ...style }}>
      {children}
    </button>
  );
}
const KEY = 'bd_selected_baby';

export default function SharePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [babies, setBabies] = useState([]);
  const [selectedBabyId, setSelectedBabyId] = useState('');
  const [memberships, setMemberships] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('caregiver');
  const [babyInvites, setBabyInvites] = useState([]);
  const [myInvites, setMyInvites] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(user);
      if (!user) return;
      const { data, error } = await supabase.from('babies').select('*').order('created_at', { ascending:false });
      if (!error) setBabies(data||[]);
      let saved = ''; try { saved = localStorage.getItem(KEY) || ''; } catch {}
      const current = saved && (data||[]).some(b => b.id===saved) ? saved : (data&&data[0]?.id) || '';
      setSelectedBabyId(current);
      refreshSharing(current);
      // Load my pending invites (visible via RLS)
      try {
        const { data: pending } = await supabase.from('invites').select('*').eq('status','pending').order('created_at', { ascending:false });
        const me = (user.email||'').toLowerCase();
        setMyInvites((pending||[]).filter(i => (i.email||'').toLowerCase()===me));
      } catch {}
    }
    const { data: authListener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) router.replace('/');
    });
    init();
    return () => { mounted=false; authListener.subscription.unsubscribe(); };
  }, [router]);

  const selectedBaby = useMemo(() => babies.find(b => b.id === selectedBabyId) || null, [babies, selectedBabyId]);

  function onSelectBaby(id) {
    setSelectedBabyId(id);
    try { localStorage.setItem(KEY, id); } catch {}
    refreshSharing(id);
  }

  async function refreshSharing(babyId) {
    if (!babyId) { setMemberships([]); setBabyInvites([]); return; }
    // memberships (server route; RLS enforced)
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (token) {
      const res = await fetch(`/api/memberships?baby_id=${babyId}`, { headers: { authorization: `Bearer ${token}` } });
      if (res.ok) {
        const payload = await res.json();
        setMemberships(payload.memberships || []);
      } else setMemberships([]);
    }
    try {
      const { data: invitesData } = await supabase.from('invites').select('*').eq('baby_id', babyId).order('created_at', { ascending:false });
      setBabyInvites(invitesData||[]);
    } catch { setBabyInvites([]); }
  }

  async function inviteUser() {
    if (!selectedBaby) return alert('Select a baby first.');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch('/api/invites', { method:'POST', headers:{ 'content-type':'application/json', authorization:`Bearer ${token}` }, body: JSON.stringify({ baby_id: selectedBaby.id, email: inviteEmail.trim(), role: inviteRole }) });
    if (!res.ok) { console.error('inviteUser error', await res.json().catch(()=>({}))); alert('Failed to invite.'); return; }
    setInviteEmail(''); refreshSharing(selectedBaby.id);
  }

  async function revokeInvite(inviteId) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch('/api/invites/revoke', { method:'POST', headers:{ 'content-type':'application/json', authorization:`Bearer ${token}` }, body: JSON.stringify({ invite_id: inviteId }) });
    if (!res.ok) { console.error('revokeInvite error', await res.json().catch(()=>({}))); alert('Failed to revoke invite.'); return; }
    refreshSharing(selectedBabyId);
  }

  async function acceptInvite(inviteId) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch('/api/invites/accept', { method:'POST', headers:{ 'content-type':'application/json', authorization:`Bearer ${token}` }, body: JSON.stringify({ invite_id: inviteId }) });
    if (!res.ok) { console.error('acceptInvite error', await res.json().catch(()=>({}))); alert('Failed to accept invite.'); return; }
    const payload = await res.json();
    const babyId = payload?.baby_id || payload?.membership?.baby_id;
    if (babyId) { setSelectedBabyId(babyId); try { localStorage.setItem(KEY, babyId); } catch {} }
    await refreshSharing(babyId || selectedBabyId);
  }

  if (!user) return null;

  return (
    <div style={{ display:'grid', gap:16 }}>
      <section style={{ padding:16, border:'1px solid #eee', borderRadius:12, background:'#fff', display:'grid', gap:12 }}>
        <h2 style={{ marginTop:0 }}>Share & Invites</h2>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <label htmlFor="babySelect"><strong>Baby:</strong></label>
          <select id="babySelect" value={selectedBabyId} onChange={(e)=>onSelectBaby(e.target.value)} style={{ padding:'8px 10px', borderRadius:10, border:'1px solid #ccc' }}>
            <option value="" disabled>Select...</option>
            {babies.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        {selectedBaby && (
          <>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginTop:4 }}>
              <input value={inviteEmail} onChange={(e)=>setInviteEmail(e.target.value)} placeholder="Invitee email" style={{ padding:'10px 12px', borderRadius:10, border:'1px solid #ccc', minWidth:220 }} />
              <select value={inviteRole} onChange={(e)=>setInviteRole(e.target.value)} style={{ padding:'8px 10px', borderRadius:10, border:'1px solid #ccc' }}>
                <option value="caregiver">Caregiver</option>
                <option value="parent">Parent</option>
              </select>
              <Button onClick={inviteUser} style={{ background:'#c7f0d8', border:'1px solid #73c69c' }}>Invite</Button>
            </div>

            <div style={{ display:'grid', gap:8, marginTop: 8 }}>
              <h3 style={{ margin:'12px 0 4px' }}>Members</h3>
              {memberships.length === 0 ? <p>No members yet.</p> : (
                <ul style={{ listStyle:'none', padding:0, margin:0 }}>
                  {memberships.map(m => (
                    <li key={m.id} style={{ padding:'8px 10px', border:'1px solid #eee', borderRadius:10, marginBottom:6, background:'#fafafa' }}>
                      <div><strong>{m.role}</strong> — {m.email || m.user_id}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ display:'grid', gap:8, marginTop: 8 }}>
              <h3 style={{ margin:'12px 0 4px' }}>Invites for this baby</h3>
              {babyInvites.length === 0 ? <p>No invites.</p> : (
                <ul style={{ listStyle:'none', padding:0, margin:0 }}>
                  {babyInvites.map(inv => (
                    <li key={inv.id} style={{ padding:'8px 10px', border:'1px solid #eee', borderRadius:10, marginBottom:6, background:'#fafafa', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div><strong>{inv.role}</strong> — {inv.email} · <em>{inv.status}</em></div>
                      {inv.status === 'pending' && <button onClick={()=>revokeInvite(inv.id)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #e5e5e5', background:'#fff' }}>Revoke</button>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <div style={{ display:'grid', gap:8, marginTop: 8 }}>
          <h3 style={{ margin:'12px 0 4px' }}>Your pending invites</h3>
          {myInvites.length === 0 ? <p>None.</p> : (
            <ul style={{ listStyle:'none', padding:0, margin:0 }}>
              {myInvites.map(inv => (
                <li key={inv.id} style={{ padding:'8px 10px', border:'1px solid #eee', borderRadius:10, marginBottom:6, background:'#fafafa', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div><strong>{inv.role}</strong> — {inv.email} · <em>{inv.status}</em></div>
                  <Button onClick={()=>acceptInvite(inv.id)} style={{ background:'#fff3b0', border:'1px solid #f0d264' }}>Accept</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
