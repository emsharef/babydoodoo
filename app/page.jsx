'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useBaby } from '@/components/BabyContext';
import BottomSheet from '@/components/BottomSheet';

function Button({ children, onClick, style, type }) {
  return (
    <button type={type||'button'} onClick={onClick} style={{ padding:'14px 18px', borderRadius:12, background:'#ffe083', border:'1px solid #e6c44a', cursor:'pointer', fontSize:16, fontWeight:600, boxShadow:'0 1px 0 rgba(0,0,0,0.05)', ...style }}>
      {children}
    </button>
  );
}

export default function LogPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const { user, babies, selectedBabyId, refreshBabies } = useBaby();
  const [events, setEvents] = useState([]);

  // Bottom sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null); // { id, event_type, meta }
  const [doo, setDoo] = useState({ consistency:'normal', color:'yellow', notes:'' });

  const redirectPath = process.env.NEXT_PUBLIC_AUTH_REDIRECT_PATH || '/auth/callback';

  useEffect(() => { if (user) refreshBabies(); }, [user, refreshBabies]);

  const selectedBaby = useMemo(() => babies.find(b => b.id === selectedBabyId) || null, [babies, selectedBabyId]);

  useEffect(() => { if (selectedBaby) fetchEvents(selectedBaby.id); else setEvents([]); }, [selectedBabyId]);

  async function fetchEvents(babyId) {
    const { data, error } = await supabase.from('events').select('*').eq('baby_id', babyId).order('occurred_at', { ascending:false }).limit(10);
    if (error) { console.error('fetchEvents error', error); return; }
    setEvents(data||[]);
  }

  async function logDooDoo() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Please sign in first.');
    if (!selectedBaby) return alert('Please select or create a baby first (Settings).');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch('/api/events', { method:'POST', headers: { 'content-type':'application/json', authorization:`Bearer ${token}` }, body: JSON.stringify({ baby_id: selectedBaby.id, event_type:'DooDoo' }) });
    if (!res.ok) { console.error('logDooDoo error', await res.json().catch(()=>({}))); alert('Failed to log event.'); return; }
    const { event } = await res.json();
    setEvents(prev => [event, ...prev].slice(0,10));

    // Open tiny bottom sheet. Auto-hide after 1s unless the user interacts.
    setEditingEvent(event);
    setDoo({ consistency:'normal', color:'yellow', notes:'' });
    setSheetOpen(true);
  }

  async function deleteEvent(id) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch(`/api/events/${id}`, { method:'DELETE', headers: { authorization:`Bearer ${token}` } });
    if (!res.ok && res.status!==204) { console.error('deleteEvent error', await res.json().catch(()=>({}))); alert('Failed to delete event.'); return; }
    setEvents(prev => prev.filter(e => e.id !== id));
    if (editingEvent?.id === id) { setSheetOpen(false); setEditingEvent(null); }
  }

  async function saveDooMeta() {
    if (!editingEvent) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch(`/api/events/${editingEvent.id}`, { method:'PATCH', headers: { 'content-type':'application/json', authorization:`Bearer ${token}` }, body: JSON.stringify({ meta: { doo } }) });
    if (!res.ok) { console.error('updateEvent error', await res.json().catch(()=>({}))); alert('Failed to save.'); return; }
    const { event } = await res.json();
    setEvents(prev => prev.map(e => e.id === event.id ? event : e));
    setSheetOpen(false); setEditingEvent(null);
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

  if (!user) {
    return (
      <div style={{ padding:24 }}>
        <h2>Welcome 👋</h2>
        <p>Enter your email to get a magic link:</p>
        <form onSubmit={sendMagicLink} style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
          <input type="email" required value={email} placeholder="you@example.com" onChange={(e)=>setEmail(e.target.value)} style={{ padding:'10px 12px', borderRadius:10, border:'1px solid #ccc', minWidth:260 }} />
          <Button type="submit" onClick={sendMagicLink} style={{ background:'#c7f0d8', border:'1px solid #73c69c' }}>{sending?'Sending...':'Send magic link'}</Button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display:'grid', gap:16 }}>
      <section style={{ padding: 16, border:'1px solid #eee', borderRadius:12, background:'#fff', display:'grid', gap:12 }}>
        <h2 style={{ marginTop:0 }}>Log events</h2>
        {!selectedBaby && <p style={{ color:'#888' }}>No baby selected. Choose one in the top bar, or create one in Settings.</p>}
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <Button onClick={logDooDoo} style={{ background:'#fff3b0', border:'1px solid #f0d264' }}>Log “DooDoo” 💩</Button>
        </div>
        <div>
          <h3 style={{ margin:'12px 0 6px' }}>Recent events</h3>
          {events.length===0 ? <p>No events yet.</p> : (
            <ul style={{ listStyle:'none', padding:0, margin:0 }}>
              {events.map(ev => (
                <li key={ev.id} style={{ padding:'8px 10px', border:'1px solid #eee', borderRadius:10, marginBottom:8, background:'#fafafa', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                  <div><strong>{ev.event_type}</strong> • {new Date(ev.occurred_at).toLocaleString()}</div>
                  <button onClick={()=>deleteEvent(ev.id)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #e5e5e5', background:'#fff' }}>Delete</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <BottomSheet open={sheetOpen} onClose={()=>{ setSheetOpen(false); setEditingEvent(null); }}>
        <div style={{ display:'grid', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <strong>Add details</strong>
          </div>
          <div style={{ display:'grid', gap:8 }}>
            <label style={lbl}>Consistency
              <select value={doo.consistency} onChange={(e)=>setDoo(prev=>({ ...prev, consistency:e.target.value }))} style={inp}>
                <option value="runny">Runny</option>
                <option value="normal">Normal</option>
                <option value="firm">Firm</option>
              </select>
            </label>
            <label style={lbl}>Color
              <select value={doo.color} onChange={(e)=>setDoo(prev=>({ ...prev, color:e.target.value }))} style={inp}>
                <option value="yellow">Yellow</option>
                <option value="green">Green</option>
                <option value="brown">Brown</option>
              </select>
            </label>
            <label style={lbl}>Notes
              <input value={doo.notes} onChange={(e)=>setDoo(prev=>({ ...prev, notes:e.target.value }))} placeholder="Optional note..." style={inp} />
            </label>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
            <button onClick={()=>editingEvent && deleteEvent(editingEvent.id)} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #ff9c9c', background:'#ffd4d4', fontWeight:600 }}>Undo</button>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>{ setSheetOpen(false); setEditingEvent(null); }} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #e5e5e5', background:'#fff' }}>Dismiss</button>
              <button onClick={saveDooMeta} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #73c69c', background:'#c7f0d8', fontWeight:600 }}>Save</button>
            </div>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

const lbl = { display:'grid', gap:6, fontSize:14 };
const inp = { padding:'10px 12px', borderRadius:10, border:'1px solid #ccc' };
