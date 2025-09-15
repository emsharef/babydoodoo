'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

function Button({ children, onClick, style, type }) {
  return (
    <button
      type={type || 'button'}
      onClick={onClick}
      style={{
        padding: '14px 18px',
        borderRadius: 12,
        background: '#ffe083',
        border: '1px solid #e6c44a',
        cursor: 'pointer',
        fontSize: 16,
        fontWeight: 600,
        boxShadow: '0 1px 0 rgba(0,0,0,0.05)',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export default function HomePage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [user, setUser] = useState(null);
  const [babies, setBabies] = useState([]);
  const [babyName, setBabyName] = useState('');
  const [selectedBabyId, setSelectedBabyId] = useState('');
  const [events, setEvents] = useState([]);
  const [loadingBabies, setLoadingBabies] = useState(false);
  const redirectPath = process.env.NEXT_PUBLIC_AUTH_REDIRECT_PATH || '/auth/callback';

  // Sharing state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('caregiver');
  const [babyInvites, setBabyInvites] = useState([]);
  const [myInvites, setMyInvites] = useState([]);
  const [memberships, setMemberships] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(user);
      if (user) { await refreshSharing(); await fetchBabies(); }
    }
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) { refreshSharing(); fetchBabies(); }
      else { setBabies([]); setEvents([]); setMyInvites([]); setBabyInvites([]); setMemberships([]); }
    });
    init();
    return () => { mounted = false; authListener.subscription.unsubscribe(); };
  }, []);

  const selectedBaby = useMemo(() => babies.find(b => b.id === selectedBabyId) || null, [babies, selectedBabyId]);

  async function fetchBabies() {
    setLoadingBabies(true);
    const { data, error } = await supabase.from('babies').select('*').order('created_at', { ascending: false });
    setLoadingBabies(false);
    if (error) { console.error('fetchBabies error', error && (error.message || error.code || error.details) ? error : '(no details)'); return; }
    setBabies(data || []);
    if (data && data.length > 0) {
      const current = selectedBabyId && data.some(b => b.id === selectedBabyId) ? selectedBabyId : data[0].id;
      setSelectedBabyId(current);
      fetchEvents(current);
      refreshSharing(current);
    } else {
      setSelectedBabyId('');
      setEvents([]);
      setMemberships([]);
      setBabyInvites([]);
    }
  }

  async function fetchEvents(babyId) {
    const { data, error } = await supabase.from('events').select('*').eq('baby_id', babyId).order('occurred_at', { ascending: false }).limit(10);
    if (error) { console.error('fetchEvents error', error?.message || error); return; }
    setEvents(data || []);
  }

  async function refreshSharing(babyId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const currentBabyId = babyId || selectedBabyId;

    // Load pending invites visible to me (RLS), then filter to my email case-insensitively
    try {
      const { data: pending, error: pendErr } = await supabase
        .from('invites')
        .select('id,baby_id,email,role,status,created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (!pendErr) {
        const me = (user.email || '').toLowerCase();
        const mine = (pending || []).filter(i => (i.email || '').toLowerCase() === me);
        setMyInvites(mine);
      } else setMyInvites([]);
    } catch { setMyInvites([]); }

    if (!currentBabyId) { setBabyInvites([]); setMemberships([]); return; }

    try {
      const { data: invitesData } = await supabase
        .from('invites')
        .select('*')
        .eq('baby_id', currentBabyId)
        .order('created_at', { ascending: false });
      setBabyInvites(invitesData || []);
    } catch { setBabyInvites([]); }

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (token) {
      const res = await fetch(`/api/memberships?baby_id=${currentBabyId}`, { headers: { authorization: `Bearer ${token}` } });
      if (res.ok) {
        const payload = await res.json();
        setMemberships(payload.memberships || []);
      } else setMemberships([]);
    }
  }

  async function sendMagicLink(e) {
    e.preventDefault();
    setSending(true);
    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}${redirectPath}` : redirectPath;
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: true } });
      if (error) throw error;
      alert('Magic link sent! Check your email.');
    } catch (err) { console.error(err); alert('Error sending magic link. See console.'); }
    finally { setSending(false); }
  }

  async function signOut() { await supabase.auth.signOut(); }

  async function createBaby() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Please sign in first.');
    if (!babyName.trim()) return alert('Enter a baby name.');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch('/api/babies', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ name: babyName.trim() }) });
    if (!res.ok) { let payload; try { payload = await res.json(); } catch { const t = await res.text(); payload = { raw: t }; } console.error('createBaby error', { status: res.status, ...payload }); alert('Failed to create baby.'); return; }
    const { baby } = await res.json();
    setBabies(prev => [baby, ...prev]); setSelectedBabyId(baby.id); setBabyName(''); fetchEvents(baby.id); refreshSharing(baby.id);
  }

  async function logDooDoo() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Please sign in first.');
    if (!selectedBaby) return alert('Please select or create a baby first.');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ baby_id: selectedBaby.id, event_type: 'DooDoo' }) });
    if (!res.ok) { let payload; try { payload = await res.json(); } catch { const t = await res.text(); payload = { raw: t }; } console.error('logDooDoo error', { status: res.status, ...payload }); alert('Failed to log event.'); return; }
    const { event } = await res.json();
    setEvents(prev => [event, ...prev].slice(0, 10));
  }

  async function deleteEvent(id) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Please sign in first.');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch(`/api/events/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
    if (!res.ok && res.status !== 204) { let payload; try { payload = await res.json(); } catch { const t = await res.text(); payload = { raw: t }; } console.error('deleteEvent error', { status: res.status, ...payload }); alert('Failed to delete event.'); return; }
    setEvents(prev => prev.filter(e => e.id !== id));
  }

  async function inviteUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Please sign in first.');
    if (!selectedBaby) return alert('Select a baby first.');
    if (!inviteEmail.trim()) return alert('Enter an email.');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch('/api/invites', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ baby_id: selectedBaby.id, email: inviteEmail.trim(), role: inviteRole }) });
    if (!res.ok) { let payload; try { payload = await res.json(); } catch { const t = await res.text(); payload = { raw: t }; } console.error('inviteUser error', { status: res.status, ...payload }); alert('Failed to invite.'); return; }
    setInviteEmail(''); refreshSharing(selectedBabyId);
  }

  async function acceptInvite(inviteId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Please sign in first.');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch('/api/invites/accept', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ invite_id: inviteId }) });
    if (!res.ok) { let payload; try { payload = await res.json(); } catch { const t = await res.text(); payload = { raw: t }; } console.error('acceptInvite error', { status: res.status, ...payload }); alert('Failed to accept invite.'); return; }
    const payload = await res.json();
    const babyId = payload?.baby_id || payload?.membership?.baby_id;
    if (babyId) { setSelectedBabyId(babyId); await fetchBabies(); await fetchEvents(babyId); }
    await refreshSharing(babyId);
  }

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Welcome 👋</h2>
        <p>Enter your email to get a magic link:</p>
        <form onSubmit={sendMagicLink} style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input type="email" required value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #ccc', minWidth: 260 }} />
          <Button type="submit" onClick={sendMagicLink} style={{ background: '#c7f0d8', border: '1px solid #73c69c' }}>{sending ? 'Sending...' : 'Send magic link'}</Button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><strong>Signed in:</strong> {user.email}</div>
        <Button onClick={() => supabase.auth.signOut()} style={{ background: '#ffd4d4', border: '1px solid #ff9c9c' }}>Sign out</Button>
      </section>

      <section style={{ padding: 16, border: '1px solid #eee', borderRadius: 12, background: '#fff' }}>
        <h2 style={{ marginTop: 0 }}>Create a new baby</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={babyName} onChange={(e) => setBabyName(e.target.value)} placeholder="Baby name" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #ccc', minWidth: 240 }} />
          <Button onClick={createBaby}>Add</Button>
        </div>
      </section>

      <section style={{ padding: 16, border: '1px solid #eee', borderRadius: 12, background: '#fff', display: 'grid', gap: 12 }}>
        <h2 style={{ marginTop: 0 }}>Log event</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap:'wrap' }}>
          <label htmlFor="babySelect"><strong>Baby:</strong></label>
          <select id="babySelect" value={selectedBabyId} onChange={(e) => { setSelectedBabyId(e.target.value); fetchEvents(e.target.value); refreshSharing(e.target.value); }} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc' }}>
            <option value="" disabled>Select...</option>
            {babies.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <Button onClick={logDooDoo} style={{ background: '#fff3b0', border: '1px solid #f0d264' }}>Log “DooDoo” 💩</Button>
        </div>
        <div style={{ marginTop: 8 }}>
          <h3 style={{ margin: '12px 0 6px' }}>Recent events</h3>
          {events.length === 0 ? <p>No events yet.</p> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {events.map(ev => (
                <li key={ev.id} style={{ padding: '8px 10px', border: '1px solid #eee', borderRadius: 10, marginBottom: 8, background: '#fafafa', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                  <div><strong>{ev.event_type}</strong> • {new Date(ev.occurred_at).toLocaleString()}</div>
                  <button onClick={() => deleteEvent(ev.id)} style={{padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e5e5', background: '#fff', cursor: 'pointer'}}>Delete</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section style={{ padding: 16, border: '1px solid #eee', borderRadius: 12, background: '#fff', display: 'grid', gap: 12 }}>
        <h2 style={{ marginTop: 0 }}>Share access</h2>
        {!selectedBaby ? <p>Select a baby to manage sharing.</p> : (
          <>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Invitee email" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #ccc', minWidth: 220 }} />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc' }}>
                <option value="caregiver">Caregiver</option>
                <option value="parent">Parent</option>
              </select>
              <Button onClick={inviteUser} style={{ background: '#c7f0d8', border: '1px solid #73c69c' }}>Invite</Button>
            </div>
            <div style={{ display:'grid', gap:8, marginTop: 8 }}>
              <h3 style={{ margin:'12px 0 4px' }}>Members</h3>
              {memberships.length === 0 ? <p>No members yet.</p> : (
                <ul style={{ listStyle:'none', padding:0, margin:0 }}>
                  {memberships.map(m => (
                    <li key={m.id} style={{ padding: '8px 10px', border: '1px solid #eee', borderRadius: 10, marginBottom: 6, background:'#fafafa' }}>
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
                    <li key={inv.id} style={{ padding: '8px 10px', border: '1px solid #eee', borderRadius: 10, marginBottom: 6, background:'#fafafa', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div><strong>{inv.role}</strong> — {inv.email} · <em>{inv.status}</em></div>
                      {inv.status === 'pending' && <button onClick={() => revokeInvite(inv.id)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #e5e5e5', background:'#fff' }}>Revoke</button>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>

      <section style={{ padding: 16, border: '1px solid #eee', borderRadius: 12, background: '#fff', display: 'grid', gap: 12 }}>
        <h2 style={{ marginTop: 0 }}>Your pending invites</h2>
        {myInvites.length === 0 ? <p>None.</p> : (
          <ul style={{ listStyle:'none', padding:0, margin:0 }}>
            {myInvites.map(inv => (
              <li key={inv.id} style={{ padding: '8px 10px', border: '1px solid #eee', borderRadius: 10, marginBottom: 6, background:'#fafafa', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div><strong>{inv.role}</strong> — {inv.email} · <em>{inv.status}</em></div>
                <Button onClick={() => acceptInvite(inv.id)} style={{ background: '#fff3b0', border: '1px solid #f0d264' }}>Accept</Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
