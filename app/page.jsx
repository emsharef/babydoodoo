'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useBaby } from '@/components/BabyContext';
import BottomSheet from '@/components/BottomSheet';
import IconButton from '@/components/IconButton';
import { EVENT_DEFS as BASE_EVENT_DEFS, applyButtonConfig } from '@/lib/events';

const DOO_COLORS = [
  { k:'yellow', emoji:'🟡', label:'Yellow' },
  { k:'green', emoji:'🟢', label:'Green' },
  { k:'brown', emoji:'🟤', label:'Brown' },
];
const DOO_CONSIST = [
  { k:'runny', emoji:'💧', label:'Runny' },
  { k:'normal', emoji:'🟠', label:'Normal' },
  { k:'firm', emoji:'🧱', label:'Firm' },
];
const MOODS = ['😄','🙂','😐','😕','😢','😡'];
const PEE_AMT = [
  { k:'small', emoji:'💧', label:'Small' },
  { k:'medium', emoji:'💦', label:'Medium' },
  { k:'large', emoji:'🌊', label:'Large' },
];
const YUM_TYPES = [
  { k:'breast', emoji:'🤱', label:'Breast' },
  { k:'bottle', emoji:'🍼', label:'Bottle' },
  { k:'formula', emoji:'🥛', label:'Formula' },
  { k:'solid', emoji:'🍎', label:'Solid' },
];
const PUKE_AMT = [
  { k:'small', emoji:'💧', label:'Small' },
  { k:'medium', emoji:'💦', label:'Medium' },
  { k:'large', emoji:'🌊', label:'Large' },
];
const MEASURE_KINDS = [
  { k:'baby_length', label:'Baby Length' },
  { k:'baby_weight', label:'Baby Weight' },
  { k:'head_circumference', label:'Head Circumference' },
  { k:'mom_belly', label:'Mom Belly' },
  { k:'mom_weight', label:'Mom Weight' },
];

function Pill({ active, onClick, children }) {
  return <button onClick={onClick} style={{ padding:'8px 12px', borderRadius:999, border:`2px solid ${active?'#444':'#ddd'}`, background: active?'#fafafa':'#fff' }}>{children}</button>
}

function Chip({ children }) {
  return <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'2px 8px', borderRadius:999, background:'#f5f5f7', border:'1px solid #e8e8ee', fontSize:13 }}>{children}</span>;
}

const findByKey = (arr, key) => arr.find(x => x.k === key) || null;

// Extract a notes string from meta (supports both top-level and nested notes for backward compatibility)
function extractNotes(meta) {
  if (!meta || typeof meta !== 'object') return '';
  if (typeof meta.notes === 'string' && meta.notes.trim().length) return meta.notes.trim();
  for (const v of Object.values(meta)) {
    if (v && typeof v === 'object' && typeof v.notes === 'string' && v.notes.trim().length) return v.notes.trim();
  }
  return '';
}

// Inline meta (excluding notes). Single line next to title.
function MetaInline({ ev }) {
  const m = ev?.meta || {};
  const chips = [];

  if (ev.event_type === 'DooDoo' && m.doo) {
    const c = findByKey(DOO_COLORS, m.doo.color);
    const s = findByKey(DOO_CONSIST, m.doo.consistency);
    if (s) chips.push(<Chip key="doo-s"><span>{s.emoji}</span><span>{s.label}</span></Chip>);
    if (c) chips.push(<Chip key="doo-c"><span>{c.emoji}</span><span>{c.label}</span></Chip>);
  }
  if (ev.event_type === 'PeePee' && m.pee) {
    const a = findByKey(PEE_AMT, m.pee.amount);
    if (a) chips.push(<Chip key="pee-a"><span>{a.emoji}</span><span>{a.label}</span></Chip>);
  }
  if (ev.event_type === 'Diaper' && m.diaper) {
    const map = { wet:'💧 Wet', dirty:'💩 Dirty', both:'💧💩 Both', dry:'🧷 Dry' };
    const label = map[m.diaper.kind] || 'Change';
    chips.push(<Chip key="diaper"><span>{label}</span></Chip>);
  }
  if (ev.event_type === 'YumYum' && m.yum) {
    const t = YUM_TYPES.find(x => x.k === m.yum.kind);
    if (t) chips.push(<Chip key="yum-k"><span>{t.emoji}</span><span>{t.label}</span></Chip>);
    if ((m.yum.quantity ?? null) !== null) chips.push(<Chip key="yum-q"><span>⚖️</span><span>{m.yum.quantity}</span><span style={{ color:'#777' }}>ml</span></Chip>);
  }
  if ((ev.event_type === 'MyMood' || ev.event_type === 'BabyMood') && m.mood) {
    chips.push(<Chip key="mood"><span>{m.mood}</span></Chip>);
  }
  if (ev.event_type === 'KickMe' && m.kick) {
    if ('count' in m.kick) chips.push(<Chip key="kick-c"><span>🦶</span><span>x{m.kick.count}</span></Chip>);
    if ('side' in m.kick) {
      const sideLabel = m.kick.side === 'L' ? 'Left' : (m.kick.side === 'R' ? 'Right' : 'Middle');
      const sideEmoji = m.kick.side === 'L' ? '⬅️' : (m.kick.side === 'R' ? '➡️' : '⬆️');
      chips.push(<Chip key="kick-s"><span>{sideEmoji}</span><span>{sideLabel}</span></Chip>);
    }
  }
  if (ev.event_type === 'Contraction' && m.contraction) {
    if ('duration_sec' in m.contraction) chips.push(<Chip key="con-d"><span>⏱️</span><span>{m.contraction.duration_sec}s</span></Chip>);
    if ('intensity' in m.contraction) chips.push(<Chip key="con-i"><span>🔥</span><span>{m.contraction.intensity}/10</span></Chip>);
  }
  if (ev.event_type === 'Temperature' && m.temp) {
    const unit = (m.temp.unit || 'F').toUpperCase();
    const val = m.temp.value;
    if (val !== undefined) chips.push(<Chip key="temp"><span>🌡️</span><span>{val}°{unit}</span></Chip>);
  }
  if (ev.event_type === 'Medicine' && m.medicine) {
    if (m.medicine.name) chips.push(<Chip key="med-n"><span>💊</span><span>{m.medicine.name}</span></Chip>);
    if (m.medicine.dose !== undefined) chips.push(<Chip key="med-d"><span>⚖️</span><span>{m.medicine.dose}{m.medicine.unit?(' '+m.medicine.unit):''}</span></Chip>);
    if (m.medicine.route) chips.push(<Chip key="med-r"><span>➡️</span><span>{m.medicine.route}</span></Chip>);
  }
  if (ev.event_type === 'Doctor' && m.doctor) {
    const kindMap = { pediatrician:'Pediatrician', obgyn:'OB‑GYN', family:'Family/GP', urgent:'Urgent Care' };
    const kind = kindMap[m.doctor.kind] || m.doctor.kind || 'Visit';
    const who = m.doctor.provider ? `· ${m.doctor.provider}` : '';
    chips.push(<Chip key="doc"><span>🩺</span><span>{kind}{who}</span></Chip>);
  }
  if (ev.event_type === 'Heartbeat' && m.heartbeat) {
    if (m.heartbeat.bpm !== undefined) chips.push(<Chip key="hb"><span>❤️</span><span>{m.heartbeat.bpm} bpm</span></Chip>);
  }
  if (ev.event_type === 'Play' && m.play) {
    const kindMap = { tummy:'Tummy Time', reading:'Reading', walk:'Walk', music:'Music', bath:'Bath' };
    const em = { tummy:'🤸', reading:'📚', walk:'🚶', music:'🎶', bath:'🛁' }[m.play.kind];
    const label = kindMap[m.play.kind] || m.play.kind;
    chips.push(<Chip key="play-k"><span>{em||'🎲'}</span><span>{label}</span></Chip>);
    if (m.play.duration_min !== undefined) chips.push(<Chip key="play-d"><span>⏱️</span><span>{m.play.duration_min}m</span></Chip>);
  }
  if (ev.event_type === 'Milestone' && m.milestone) {
    const catMap = { first:'Firsts', motor:'Motor', social:'Social', language:'Language' };
    const cat = catMap[m.milestone.category] || null;
    if (m.milestone.title) chips.push(<Chip key="mile-t"><span>⭐</span><span>{m.milestone.title}</span></Chip>);
    if (cat) chips.push(<Chip key="mile-c"><span>🏷️</span><span>{cat}</span></Chip>);
  }
  if (ev.event_type === 'Measure' && m.measure) {
    const kindMap = { baby_length:'Baby Length', head_circumference:'Head Circumference', mom_belly:'Mom Belly', mom_waist:'Mom Waist' };
    const kind = kindMap[m.measure.kind] || m.measure.kind;
    if (m.measure.inches !== undefined) chips.push(<Chip key="meas"><span>📏</span><span>{kind}</span><span>{m.measure.inches} in</span></Chip>);
  }
  if (ev.event_type === 'Puke' && m.puke) {
    const a = findByKey(PUKE_AMT, m.puke.amount);
    chips.push(<Chip key="puke"><span>🤮</span>{a ? <><span>{a.emoji}</span><span>{a.label}</span></> : null}</Chip>);
  }
  if (ev.event_type === 'Sick') {
    chips.push(<Chip key="sick"><span>🤒</span><span>Sick</span></Chip>);
  }
  if (ev.event_type === 'SleepStart') {
    chips.push(<Chip key="sstart"><span>🛌</span><span>Start</span></Chip>);
  }
  if (ev.event_type === 'SleepEnd' && m.sleep) {
    if (m.sleep.duration_min !== undefined) chips.push(<Chip key="send"><span>🛌</span><span>End</span><span>·</span><span>{m.sleep.duration_min}m</span></Chip>);
    else chips.push(<Chip key="send"><span>🛌</span><span>End</span></Chip>);
  }
  if (ev.event_type === 'CryCry') chips.push(<Chip key="cry"><span>😭</span><span>Cry</span></Chip>);
  if (ev.event_type === 'BlahBlah') chips.push(<Chip key="blah"><span>🗣️</span><span>Babble</span></Chip>);

  if (chips.length === 0) return null;
  return <span style={{ display:'inline-flex', flexWrap:'wrap', gap:6, marginLeft:8 }}>{chips}</span>;
}

export default function LogPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const { user, babies, selectedBabyId, refreshBabies } = useBaby();
  const [events, setEvents] = useState([]);
  const [hoverId, setHoverId] = useState('');
  const [buttonConfig, setButtonConfig] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const hoverTimerRef = useRef(null);

  // Bottom sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null); // full event row
  const [activeType, setActiveType] = useState(null);
  const [metaDraft, setMetaDraft] = useState({}); // per-type + optional top-level notes

  const redirectPath = process.env.NEXT_PUBLIC_AUTH_REDIRECT_PATH || '/auth/callback';

  useEffect(() => { if (user) refreshBabies(); }, [user, refreshBabies]);
  const selectedBaby = useMemo(() => babies.find(b => b.id === selectedBabyId) || null, [babies, selectedBabyId]);
  useEffect(() => { 
    if (selectedBaby) { 
      // Try local cache immediately to avoid flash
      try {
        const cached = typeof window !== 'undefined' ? localStorage.getItem('button_config:' + selectedBaby.id) : null;
        if (cached) {
          setButtonConfig(JSON.parse(cached));
          setConfigLoaded(true);
        } else {
          setConfigLoaded(false);
        }
      } catch { setConfigLoaded(false); }
      fetchEvents(selectedBaby.id);
      fetchButtonConfig(selectedBaby.id);
    } else { 
      setEvents([]); 
      setButtonConfig(null); 
      setConfigLoaded(true);
    } 
  }, [selectedBabyId]);

  async function fetchButtonConfig(babyId) {
    const { data, error } = await supabase.from('babies').select('button_config').eq('id', babyId).single();
    if (error) { console.error('fetchButtonConfig error', error); setConfigLoaded(true); return; }
    const cfg = data?.button_config || null;
    setButtonConfig(cfg);
    setConfigLoaded(true);
    // update cache
    try {
      if (typeof window !== 'undefined' && cfg) {
        localStorage.setItem('button_config:' + babyId, JSON.stringify(cfg));
      }
    } catch {}
  }

  async function fetchEvents(babyId) {
    const { data, error } = await supabase.from('events').select('*').eq('baby_id', babyId).order('occurred_at', { ascending:false }).limit(10);
    if (error) { console.error('fetchEvents error', error); return; }
    setEvents(data||[]);
  }

  const EVENT_DEFS = useMemo(() => {
    if (!configLoaded) return [];
    return applyButtonConfig(BASE_EVENT_DEFS, buttonConfig);
  }, [buttonConfig, configLoaded]);

  async function logEvent(type) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Please sign in first.');
    if (!selectedBaby) return alert('Please select or create a baby first (Settings).');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch('/api/events', { method:'POST', headers: { 'content-type':'application/json', authorization:`Bearer ${token}` }, body: JSON.stringify({ baby_id: selectedBaby.id, event_type:type }) });
    if (!res.ok) { console.error('logEvent error', await res.json().catch(()=>({}))); alert('Failed to log event.'); return; }
    const { event } = await res.json();
    setEvents(prev => [event, ...prev].slice(0,10));
    setEditingEvent(event);
    setActiveType(type);
    // defaults per type (notes are always optional at top-level)
    if (type==='DooDoo') setMetaDraft({ doo: { consistency:'normal', color:'yellow' }, notes:'' });
    else if (type==='PeePee') setMetaDraft({ pee: { amount:'medium' }, notes:'' });
    else if (type==='Diaper') setMetaDraft({ diaper: { kind:'wet' }, notes:'' });
    else if (type==='YumYum') setMetaDraft({ yum: { kind:'bottle', quantity: 60 }, notes:'' });
    else if (type==='MyMood') setMetaDraft({ mood: '🙂', notes:'' });
    else if (type==='BabyMood') setMetaDraft({ mood: '🙂', notes:'' });
    else if (type==='KickMe') setMetaDraft({ kick: { count: 1, side: 'M' }, notes:'' });
    else if (type==='Contraction') setMetaDraft({ contraction: { intensity: 5, duration_sec: 30 }, notes:'' });
    else if (type==='Temperature') setMetaDraft({ temp: { unit:'F', value: 98.6 }, notes:'' });
    else if (type==='Medicine') setMetaDraft({ medicine: { name:'', dose: 0, unit:'mg', route:'PO' }, notes:'' });
    else if (type==='Doctor') setMetaDraft({ doctor: { kind:'pediatrician', provider:'' }, notes:'' });
    else if (type==='Heartbeat') setMetaDraft({ heartbeat: { bpm: 140 }, notes:'' });
    else if (type==='Play') setMetaDraft({ play: { kind:'tummy', duration_min: 10 }, notes:'' });
    else if (type==='Milestone') setMetaDraft({ milestone: { title:'', category:'first' }, notes:'' });
    else if (type==='Note') setMetaDraft({ notes:'' });
    else if (type==='Puke') setMetaDraft({ puke: { amount:'small' }, notes:'' });
    else if (type==='SleepEnd') setMetaDraft({ sleep: { duration_min: 60 }, notes:'' });
    else setMetaDraft({ notes:'' });
    setSheetOpen(true);
  }

  async function deleteEvent(id) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch(`/api/events/${id}`, { method:'DELETE', headers: { authorization:`Bearer ${token}` } });
    if (!res.ok && res.status!==204) { console.error('deleteEvent error', await res.json().catch(()=>({}))); alert('Failed to delete event.'); return; }
    setEvents(prev => prev.filter(e => e.id !== id));
    if (editingEvent?.id === id) { setSheetOpen(false); setEditingEvent(null); setActiveType(null); }
  }

  async function saveMeta() {
    if (!editingEvent) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch(`/api/events/${editingEvent.id}`, { method:'PATCH', headers: { 'content-type':'application/json', authorization:`Bearer ${token}` }, body: JSON.stringify({ meta: metaDraft }) });
    if (!res.ok) { console.error('updateEvent error', await res.json().catch(()=>({}))); alert('Failed to save.'); return; }
    const { event } = await res.json();
    setEvents(prev => prev.map(e => e.id === event.id ? event : e));
    setSheetOpen(false); setEditingEvent(null); setActiveType(null);
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

  const showTrash = (id) => hoverId === id;
  const onTouch = (id) => {
    setHoverId(id);
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHoverId(''), 2000);
  };

  if (!user) {
    return (
      <div style={{ padding:24 }}>
        <h2>Welcome 👋</h2>
        <p>Enter your email to get a magic link:</p>
        <form onSubmit={sendMagicLink} style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
          <input type="email" required value={email} placeholder="you@example.com" onChange={(e)=>setEmail(e.target.value)} style={{ padding:'10px 12px', borderRadius:10, border:'1px solid #ccc', minWidth:260 }} />
          <button type="submit" onClick={sendMagicLink} style={{ padding:'12px 14px', borderRadius:12, background:'#c7f0d8', border:'1px solid #73c69c', cursor:'pointer', fontWeight:700 }}>{sending?'Sending...':'Send magic link'}</button>
        </form>
      </div>
    );
  }

  const grid = (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:10 }}>
      {EVENT_DEFS.map(def => (
        <IconButton key={def.type} emoji={def.emoji} label={def.label} color={def.bg} border={def.bd} onClick={()=>logEvent(def.type)} />
      ))}
    </div>
  );

  return (
    <div style={{ display:'grid', gap:16 }}>
      <section style={{ padding: 12, border:'1px solid #eee', borderRadius:12, background:'#fff', display:'grid', gap:12 }}>
        {!selectedBaby && <p style={{ color:'#888' }}>No baby selected. Choose one in the top bar, or create one in Settings.</p>}
        {/* Avoid flash: if config not loaded and no cache, show a light skeleton instead of full grid */}
        {(!configLoaded && EVENT_DEFS.length===0) ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:10 }}>
            {Array.from({length:8}).map((_,i)=>(
              <div key={i} style={{ height:72, borderRadius:12, border:'1px solid #eee', background:'#f7f7f9', animation:'pulse 1.2s ease-in-out infinite' }} />
            ))}
            <style jsx>{`@keyframes pulse { 0%{opacity:.5} 50%{opacity:1} 100%{opacity:.5} }`}</style>
          </div>
        ) : grid}
        <div>
          <h3 style={{ margin:'12px 0 6px', fontFamily:'Nunito, Inter, sans-serif' }}>Recent events</h3>
          {events.length===0 ? <p>No events yet.</p> : (
            <ul style={{ listStyle:'none', padding:0, margin:0 }}>
              {events.map(ev => {
                const notes = extractNotes(ev?.meta);
                return (
                <li
                  key={ev.id}
                  onMouseEnter={()=>setHoverId(ev.id)}
                  onMouseLeave={()=>setHoverId('')}
                  onTouchStart={()=>onTouch(ev.id)}
                  style={{ position:'relative', padding:'10px 12px', border:'1px solid #eee', borderRadius:10, marginBottom:8, background:'#fafafa', display:'grid', gap:4 }}
                >
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <strong>{ev.event_type}</strong>
                      <MetaInline ev={ev} />
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <time style={{ whiteSpace:'nowrap', color:'#666', fontSize:13 }}>{new Date(ev.occurred_at).toLocaleString()}</time>
                      <button
                        aria-label="Delete"
                        title="Delete"
                        onClick={()=>deleteEvent(ev.id)}
                        style={{
                          opacity: showTrash(ev.id) ? 1 : 0,
                          transition: 'opacity .15s ease',
                          padding:'6px 8px',
                          borderRadius:8,
                          border:'1px solid #e5e5e5',
                          background:'#fff',
                          cursor:'pointer'
                        }}
                      >🗑️</button>
                    </div>
                  </div>
                  {notes ? <div style={{ color:'#555', fontSize:13 }}>📝 {notes}</div> : null}
                </li>
              )})}
            </ul>
          )}
        </div>
      </section>

      <BottomSheet open={sheetOpen} onClose={()=>{ setSheetOpen(false); setEditingEvent(null); setActiveType(null); }} autoHideMs={5000}>
        <div style={{ display:'grid', gap:10 }}>
          {activeType && <strong style={{ fontFamily:'Nunito, Inter, sans-serif' }}>Add details · {activeType}</strong>}

          {/* Per-type editors */}
          {activeType==='DooDoo' && (
            <div style={{ display:'grid', gap:10 }}>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {DOO_CONSIST.map(opt => (
                  <Pill key={opt.k} active={metaDraft?.doo?.consistency===opt.k} onClick={()=>setMetaDraft(prev=>({ ...prev, doo: { ...(prev.doo||{}), consistency: opt.k } }))}>
                    <span style={{ marginRight:6 }}>{opt.emoji}</span>{opt.label}
                  </Pill>
                ))}
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {DOO_COLORS.map(opt => (
                  <Pill key={opt.k} active={metaDraft?.doo?.color===opt.k} onClick={()=>setMetaDraft(prev=>({ ...prev, doo: { ...(prev.doo||{}), color: opt.k } }))}>
                    <span style={{ marginRight:6 }}>{opt.emoji}</span>{opt.label}
                  </Pill>
                ))}
              </div>
            </div>
          )}

          {activeType==='PeePee' && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {PEE_AMT.map(opt => (
                <Pill key={opt.k} active={metaDraft?.pee?.amount===opt.k} onClick={()=>setMetaDraft(prev=>({ ...prev, pee: { amount: opt.k } }))}>
                  {opt.emoji} {opt.label}
                </Pill>
              ))}
            </div>
          )}

          {activeType==='Diaper' && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {['wet','dirty','both','dry'].map(k => (
                <Pill key={k} active={metaDraft?.diaper?.kind===k} onClick={()=>setMetaDraft(prev=>({ ...prev, diaper: { kind: k } }))}>
                  {k==='wet'?'💧 Wet':k==='dirty'?'💩 Dirty':k==='both'?'💧💩 Both':'🧷 Dry'}
                </Pill>
              ))}
            </div>
          )}

          {activeType==='YumYum' && (
            <div style={{ display:'grid', gap:10 }}>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {YUM_TYPES.map(opt => (
                  <Pill key={opt.k} active={metaDraft?.yum?.kind===opt.k} onClick={()=>setMetaDraft(prev=>({ ...prev, yum: { ...(prev.yum||{}), kind: opt.k } }))}>
                    <span style={{ marginRight:6 }}>{opt.emoji}</span>{opt.label}
                  </Pill>
                ))}
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span>Quantity</span>
                <input type="number" min="0" value={metaDraft?.yum?.quantity||0} onChange={(e)=>setMetaDraft(prev=>({ ...prev, yum: { ...(prev.yum||{}), quantity: Number(e.target.value||0) } }))} style={{ padding:'8px 10px', borderRadius:10, border:'1px solid #ccc', width:120 }} />
                <span style={{ color:'#666' }}>ml</span>
              </label>
            </div>
          )}

          {activeType==='MyMood' && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {MOODS.map(m => (
                <button key={m} onClick={()=>setMetaDraft({ ...metaDraft, mood: m })} style={{ fontSize:24, padding:'6px 10px', borderRadius:10, border:`2px solid ${metaDraft?.mood===m ? '#444':'#ddd'}`, background:'#fff' }}>{m}</button>
              ))}
            </div>
          )}

          {activeType==='BabyMood' && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {MOODS.map(m => (
                <button key={m} onClick={()=>setMetaDraft({ ...metaDraft, mood: m })} style={{ fontSize:24, padding:'6px 10px', borderRadius:10, border:`2px solid ${metaDraft?.mood===m ? '#444':'#ddd'}`, background:'#fff' }}>{m}</button>
              ))}
            </div>
          )}

          {activeType==='KickMe' && (
            <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
              <label>Count
                <input type="number" min="1" value={metaDraft?.kick?.count||1} onChange={(e)=>setMetaDraft(prev=>({ ...prev, kick: { ...(prev.kick||{}), count: Number(e.target.value||1) } }))} style={{ marginLeft:8, padding:'8px 10px', borderRadius:10, border:'1px solid #ccc', width:100 }} />
              </label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <Pill active={metaDraft?.kick?.side==='L'} onClick={()=>setMetaDraft(prev=>({ ...prev, kick: { ...(prev.kick||{}), side:'L' } }))}>⬅️ Left</Pill>
                <Pill active={metaDraft?.kick?.side==='M'} onClick={()=>setMetaDraft(prev=>({ ...prev, kick: { ...(prev.kick||{}), side:'M' } }))}>⬆️ Middle</Pill>
                <Pill active={metaDraft?.kick?.side==='R'} onClick={()=>setMetaDraft(prev=>({ ...prev, kick: { ...(prev.kick||{}), side:'R' } }))}>Right ➡️</Pill>
              </div>
            </div>
          )}

          {activeType==='Contraction' && (
            <div style={{ display:'grid', gap:10 }}>
              <label>Intensity (1–10)
                <input type="number" min="1" max="10" value={metaDraft?.contraction?.intensity||5} onChange={(e)=>setMetaDraft(prev=>({ ...prev, contraction: { ...(prev.contraction||{}), intensity: Number(e.target.value||5) } }))} style={{ marginLeft:8, padding:'8px 10px', borderRadius:10, border:'1px solid #ccc', width:120 }} />
              </label>
              <label>Duration (sec)
                <input type="number" min="0" value={metaDraft?.contraction?.duration_sec||30} onChange={(e)=>setMetaDraft(prev=>({ ...prev, contraction: { ...(prev.contraction||{}), duration_sec: Number(e.target.value||0) } }))} style={{ marginLeft:8, padding:'8px 10px', borderRadius:10, border:'1px solid #ccc', width:120 }} />
              </label>
            </div>
          )}

          {activeType==='Temperature' && (
            <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
              <label>Value
                <input type="number" step="0.1" value={metaDraft?.temp?.value ?? 98.6} onChange={(e)=>setMetaDraft(prev=>({ ...prev, temp: { ...(prev.temp||{ unit:'F' }), value: Number(e.target.value || 0) } }))} style={{ marginLeft:8, padding:'8px 10px', borderRadius:10, border:'1px solid #ccc', width:120 }} />
              </label>
              <div style={{ display:'flex', gap:8 }}>
                <Pill active={(metaDraft?.temp?.unit||'F')==='F'} onClick={()=>setMetaDraft(prev=>({ ...prev, temp: { ...(prev.temp||{}), unit:'F' } }))}>°F</Pill>
                <Pill active={(metaDraft?.temp?.unit||'F')==='C'} onClick={()=>setMetaDraft(prev=>({ ...prev, temp: { ...(prev.temp||{}), unit:'C' } }))}>°C</Pill>
              </div>
            </div>
          )}

          {activeType==='Medicine' && (
            <div style={{ display:'grid', gap:10 }}>
              <label>Name
                <input value={metaDraft?.medicine?.name || ''} onChange={(e)=>setMetaDraft(prev=>({ ...prev, medicine: { ...(prev.medicine||{}), name: e.target.value } }))} placeholder="e.g., Acetaminophen" style={{ marginLeft:8, padding:'8px 10px', borderRadius:10, border:'1px solid #ccc', width:'100%' }} />
              </label>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <label>Dose
                  <input type="number" step="0.1" min="0" value={metaDraft?.medicine?.dose ?? 0} onChange={(e)=>setMetaDraft(prev=>({ ...prev, medicine: { ...(prev.medicine||{}), dose: Number(e.target.value || 0) } }))} style={{ marginLeft:8, padding:'8px 10px', borderRadius:10, border:'1px solid #ccc', width:120 }} />
                </label>
                <div style={{ display:'flex', gap:8 }}>
                  {['mg','ml','drops'].map(u => (
                    <Pill key={u} active={(metaDraft?.medicine?.unit||'mg')===u} onClick={()=>setMetaDraft(prev=>({ ...prev, medicine: { ...(prev.medicine||{}), unit: u } }))}>{u}</Pill>
                  ))}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  {[{k:'PO',label:'Oral'},{k:'Topical',label:'Topical'},{k:'Other',label:'Other'}].map(r => (
                    <Pill key={r.k} active={(metaDraft?.medicine?.route||'PO')===r.k} onClick={()=>setMetaDraft(prev=>({ ...prev, medicine: { ...(prev.medicine||{}), route: r.k } }))}>{r.label}</Pill>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeType==='Doctor' && (
            <div style={{ display:'grid', gap:10 }}>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[{k:'pediatrician',label:'Pediatrician'},{k:'obgyn',label:'OB‑GYN'},{k:'family',label:'Family/GP'},{k:'urgent',label:'Urgent Care'}].map(d => (
                  <Pill key={d.k} active={(metaDraft?.doctor?.kind||'pediatrician')===d.k} onClick={()=>setMetaDraft(prev=>({ ...prev, doctor: { ...(prev.doctor||{}), kind: d.k } }))}>{d.label}</Pill>
                ))}
              </div>
              <label>Provider
                <input value={metaDraft?.doctor?.provider || ''} onChange={(e)=>setMetaDraft(prev=>({ ...prev, doctor: { ...(prev.doctor||{}), provider: e.target.value } }))} placeholder="Dr. Smith" style={{ marginLeft:8, padding:'8px 10px', borderRadius:10, border:'1px solid #ccc', width:'100%' }} />
              </label>
            </div>
          )}

          {activeType==='Heartbeat' && (
            <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
              <label>BPM
                <input type="number" min="0" value={metaDraft?.heartbeat?.bpm ?? 140} onChange={(e)=>setMetaDraft(prev=>({ ...prev, heartbeat: { ...(prev.heartbeat||{}), bpm: Number(e.target.value || 0) } }))} style={{ marginLeft:8, padding:'8px 10px', borderRadius:10, border:'1px solid #ccc', width:140 }} />
              </label>
            </div>
          )}

          {activeType==='Play' && (
            <div style={{ display:'grid', gap:10 }}>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[{k:'tummy',label:'Tummy Time',emoji:'🤸'},{k:'reading',label:'Reading',emoji:'📚'},{k:'walk',label:'Walk',emoji:'🚶'},{k:'music',label:'Music',emoji:'🎶'},{k:'bath',label:'Bath',emoji:'🛁'}].map(p => (
                  <Pill key={p.k} active={(metaDraft?.play?.kind||'tummy')===p.k} onClick={()=>setMetaDraft(prev=>({ ...prev, play: { ...(prev.play||{}), kind: p.k } }))}>{p.emoji} {p.label}</Pill>
                ))}
              </div>
              <label>Duration (min)
                <input type="number" min="0" value={metaDraft?.play?.duration_min ?? 10} onChange={(e)=>setMetaDraft(prev=>({ ...prev, play: { ...(prev.play||{}), duration_min: Number(e.target.value || 0) } }))} style={{ marginLeft:8, padding:'8px 10px', borderRadius:10, border:'1px solid #ccc', width:160 }} />
              </label>
            </div>
          )}

          {activeType==='Milestone' && (
            <div style={{ display:'grid', gap:10 }}>
              <label>Title
                <input value={metaDraft?.milestone?.title || ''} onChange={(e)=>setMetaDraft(prev=>({ ...prev, milestone: { ...(prev.milestone||{}), title: e.target.value } }))} placeholder="e.g., First Smile" style={{ marginLeft:8, padding:'8px 10px', borderRadius:10, border:'1px solid #ccc', width:'100%' }} />
              </label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[{k:'first',label:'Firsts'},{k:'motor',label:'Motor'},{k:'social',label:'Social'},{k:'language',label:'Language'}].map(m => (
                  <Pill key={m.k} active={(metaDraft?.milestone?.category||'first')===m.k} onClick={()=>setMetaDraft(prev=>({ ...prev, milestone: { ...(prev.milestone||{}), category: m.k } }))}>{m.label}</Pill>
                ))}
              </div>
            </div>
          )}

          {activeType==='Measure' && (
            <div style={{ display:'grid', gap:10 }}>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[{k:'baby_length',label:'Baby Length'},{k:'head_circumference',label:'Head Circumference'},{k:'mom_belly',label:'Mom Belly'},{k:'mom_waist',label:'Mom Waist'}].map(opt => (
                  <Pill key={opt.k} active={metaDraft?.measure?.kind===opt.k} onClick={()=>setMetaDraft(prev=>({ ...prev, measure: { ...(prev.measure||{}), kind: opt.k } }))}>{opt.label}</Pill>
                ))}
              </div>
              <label>Value (inches)
                <input type="number" step="0.1" min="0" value={metaDraft?.measure?.inches ?? 20} onChange={(e)=>setMetaDraft(prev=>({ ...prev, measure: { ...(prev.measure||{}), inches: Number(e.target.value || 0) } }))} style={{ marginLeft:8, padding:'8px 10px', borderRadius:10, border:'1px solid #ccc', width:160 }} />
              </label>
            </div>
          )}

          {activeType==='Puke' && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {PUKE_AMT.map(opt => (
                <Pill key={opt.k} active={metaDraft?.puke?.amount===opt.k} onClick={()=>setMetaDraft(prev=>({ ...prev, puke: { amount: opt.k } }))}>
                  {opt.emoji} {opt.label}
                </Pill>
              ))}
            </div>
          )}

          {activeType==='SleepEnd' && (
            <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
              <label>Duration (min)
                <input type="number" min="0" value={metaDraft?.sleep?.duration_min ?? 60} onChange={(e)=>setMetaDraft(prev=>({ ...prev, sleep: { ...(prev.sleep||{}), duration_min: Number(e.target.value || 0) } }))} style={{ marginLeft:8, padding:'8px 10px', borderRadius:10, border:'1px solid #ccc', width:140 }} />
              </label>
            </div>
          )}

          {/* Shared optional notes for ALL event types */}
          <label style={{ display:'grid', gap:6 }}>
            <span>Notes (optional)</span>
            <input
              value={metaDraft?.notes || ''}
              onChange={(e)=>setMetaDraft(prev=>({ ...prev, notes: e.target.value }))}
              placeholder="Add an optional note…"
              style={{ padding:'10px 12px', borderRadius:10, border:'1px solid #ccc' }}
            />
          </label>

          <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginTop:6 }}>
            <button onClick={()=>editingEvent && deleteEvent(editingEvent.id)} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #ff9c9c', background:'#ffd4d4', fontWeight:700 }}>Undo</button>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>{ setSheetOpen(false); setEditingEvent(null); setActiveType(null); }} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #e5e5e5', background:'#fff' }}>Dismiss</button>
              <button onClick={saveMeta} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #73c69c', background:'#c7f0d8', fontWeight:700 }}>Save</button>
            </div>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
