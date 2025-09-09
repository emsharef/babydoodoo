'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

function Button({ children, onClick, style }) {
  return (
    <button
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
  const redirectPath = process.env.NEXT_PUBLIC_AUTH_REDIRECT_PATH || '/auth/callback';

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(user);
      if (user) await fetchBabies(user.id);
    }
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchBabies(session.user.id);
      else { setBabies([]); setEvents([]); }
    });
    init();
    return () => { mounted = false; authListener.subscription.unsubscribe(); };
  }, []);

  const selectedBaby = useMemo(() => babies.find(b => b.id === selectedBabyId) || null, [babies, selectedBabyId]);

  async function fetchBabies(userId) {
    const { data, error } = await supabase.from('babies').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) { console.error('fetchBabies error', error); return; }
    setBabies(data || []);
    if (data && data.length > 0) {
      setSelectedBabyId(prev => prev || data[0].id);
      fetchEvents(data[0].id);
    }
  }

  async function fetchEvents(babyId) {
    const { data, error } = await supabase.from('events').select('*').eq('baby_id', babyId).order('occurred_at', { ascending: false }).limit(10);
    if (error) { console.error('fetchEvents error', error); return; }
    setEvents(data || []);
  }

  async function sendMagicLink(e) {
    e.preventDefault();
    setSending(true);
    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}${redirectPath}` : redirectPath;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      });
      if (error) throw error;
      alert('Magic link sent! Check your email.');
    } catch (err) {
      console.error(err);
      alert('Error sending magic link. See console.');
    } finally {
      setSending(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function createBaby() {
    if (!user) return alert('Please sign in first.');
    if (!babyName.trim()) return alert('Enter a baby name.');
    const { data, error } = await supabase.from('babies').insert([{ name: babyName.trim(), user_id: user.id }]).select('*').single();
    if (error) { console.error(error); alert('Failed to create baby.'); return; }
    setBabies(prev => [data, ...prev]);
    setSelectedBabyId(data.id);
    setBabyName('');
    fetchEvents(data.id);
  }

  async function logDooDoo() {
    if (!user) return alert('Please sign in first.');
    if (!selectedBaby) return alert('Please select or create a baby first.');
    const { data, error } = await supabase.from('events').insert([{
      baby_id: selectedBaby.id,
      user_id: user.id,
      event_type: 'DooDoo',
      meta: {},
    }]).select('*').single();
    if (error) { console.error(error); alert('Failed to log event.'); return; }
    setEvents(prev => [data, ...prev].slice(0, 10));
  }

  async function deleteEvent(id) {
    if (!user) return alert('Please sign in first.');
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) { console.error(error); alert('Failed to delete event.'); return; }
    setEvents(prev => prev.filter(e => e.id !== id));
  }

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Welcome 👋</h1>
        <p>Enter your email to get a magic link:</p>
        <form onSubmit={sendMagicLink} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            type="email"
            required
            value={email}
            placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #ccc', minWidth: 260 }}
          />
          <Button onClick={sendMagicLink} style={{ background: '#c7f0d8', borderColor: '#73c69c' }}>
            {sending ? 'Sending...' : 'Send magic link'}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><strong>Signed in:</strong> {user.email}</div>
        <Button onClick={signOut} style={{ background: '#ffd4d4', borderColor: '#ff9c9c' }}>Sign out</Button>
      </section>

      <section style={{ padding: 16, border: '1px solid #eee', borderRadius: 12, background: '#fff' }}>
        <h2 style={{ marginTop: 0 }}>Create a new baby</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={babyName}
            onChange={(e) => setBabyName(e.target.value)}
            placeholder="Baby name"
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #ccc', minWidth: 240 }}
          />
          <Button onClick={createBaby}>Add</Button>
        </div>
      </section>

      <section style={{ padding: 16, border: '1px solid #eee', borderRadius: 12, background: '#fff', display: 'grid', gap: 12 }}>
        <h2 style={{ marginTop: 0 }}>Log event</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label htmlFor="babySelect"><strong>Baby:</strong></label>
          <select
            id="babySelect"
            value={selectedBabyId}
            onChange={(e) => { setSelectedBabyId(e.target.value); fetchEvents(e.target.value); }}
            style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc' }}
          >
            <option value="" disabled>Select...</option>
            {babies.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <Button onClick={logDooDoo} style={{ background: '#fff3b0', borderColor: '#f0d264' }}>Log “DooDoo” 💩</Button>
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
    </div>
  );
}
