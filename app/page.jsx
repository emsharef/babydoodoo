'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useBaby } from '@/components/BabyContext';
import { useLanguage } from '@/components/LanguageContext';
import BottomSheet from '@/components/BottomSheet';
import IconButton from '@/components/IconButton';
import { EVENT_DEFS as BASE_EVENT_DEFS, applyButtonConfig } from '@/lib/events';

// Helper to get event colors by type
const EVENT_COLORS = BASE_EVENT_DEFS.reduce((acc, def) => {
  acc[def.type] = { bg: def.bg, bd: def.bd, emoji: def.emoji };
  return acc;
}, {});
import { IconFilter, IconPencil } from '@tabler/icons-react';

function toDateTimeLocalString(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDateTimeLocalString(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function Pill({ active, onClick, children }) {
  return <button onClick={onClick} style={{
    padding: '10px 14px',
    borderRadius: 12,
    border: active ? '2px solid #8b5cf6' : '1px solid rgba(0, 0, 0, 0.1)',
    background: active
      ? 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)'
      : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    cursor: 'pointer',
    fontWeight: 600,
    color: active ? '#7c3aed' : '#475569',
    boxShadow: active ? '0 2px 8px rgba(139, 92, 246, 0.2)' : '0 1px 4px rgba(0, 0, 0, 0.04)',
    transition: 'all 0.15s ease',
  }}>{children}</button>
}

// Helper to convert hex to rgba
function hexToRgba(hex, alpha) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = num >> 16;
  const g = (num >> 8) & 0x00FF;
  const b = num & 0x0000FF;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function Chip({ children, bg, bd }) {
  // Use event colors if provided, otherwise fall back to neutral
  const background = bg
    ? `linear-gradient(135deg, ${hexToRgba(bg, 0.85)} 0%, ${hexToRgba(bg, 0.6)} 100%)`
    : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
  const border = bd
    ? `1px solid ${hexToRgba(bd, 0.7)}`
    : '1px solid rgba(0, 0, 0, 0.06)';

  return <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 10px',
    borderRadius: 999,
    background,
    border,
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    color: '#475569',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
  }}>{children}</span>;
}

function QuickButtons({ values, activeValue, onSelect, format }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {values.map(val => {
        const isActive = activeValue === val;
        return (
          <button
            key={val}
            type="button"
            onClick={() => onSelect(val)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: isActive ? '2px solid #8b5cf6' : '1px solid rgba(0, 0, 0, 0.08)',
              background: isActive
                ? 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 600,
              color: isActive ? '#7c3aed' : '#475569',
              boxShadow: isActive ? '0 2px 6px rgba(139, 92, 246, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.15s ease',
            }}
          >
            {format ? format(val) : val}
          </button>
        );
      })}
    </div>
  );
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
function MetaInline({ ev, t, eventColor }) {
  const m = ev?.meta || {};
  const chips = [];
  const bg = eventColor?.bg;
  const bd = eventColor?.bd;

  if (ev.event_type === 'DooDoo' && m.doo) {
    const c = m.doo.color;
    const s = m.doo.consistency;
    if (s) chips.push(<Chip bg={bg} bd={bd} key="doo-s"><span>{s === 'runny' ? '💧' : s === 'normal' ? '🟠' : '🧱'}</span><span>{t(`val.${s}`)}</span></Chip>);
    if (c) chips.push(<Chip bg={bg} bd={bd} key="doo-c"><span>{c === 'yellow' ? '🟡' : c === 'green' ? '🟢' : '🟤'}</span><span>{t(`val.${c}`)}</span></Chip>);
  }
  if (ev.event_type === 'PeePee' && m.pee) {
    const a = m.pee.amount;
    if (a) chips.push(<Chip bg={bg} bd={bd} key="pee-a"><span>{a === 'small' ? '💧' : a === 'medium' ? '💦' : '🌊'}</span><span>{t(`val.${a}`)}</span></Chip>);
  }
  if (ev.event_type === 'Diaper' && m.diaper) {
    const map = { wet: '💧 ' + t('val.wet'), dirty: '💩 ' + t('val.dirty'), both: '💧💩 ' + t('val.both'), dry: '🧷 ' + t('val.dry') };
    const label = map[m.diaper.kind] || 'Change';
    chips.push(<Chip bg={bg} bd={bd} key="diaper"><span>{label}</span></Chip>);
  }
  if (ev.event_type === 'YumYum' && m.yum) {
    const k = m.yum.kind;
    const em = k === 'breast' ? '🤱' : k === 'bottle' ? '🍼' : k === 'formula' ? '🥛' : '🍎';
    if (k) chips.push(<Chip bg={bg} bd={bd} key="yum-k"><span>{em}</span><span>{t(`val.${k}`)}</span></Chip>);
    if (k === 'breast' && m.yum.side) {
      const sideEmoji = m.yum.side === 'left' ? '⬅️' : m.yum.side === 'right' ? '➡️' : '↔️';
      chips.push(<Chip bg={bg} bd={bd} key="yum-side"><span>{sideEmoji}</span><span>{t(`val.${m.yum.side}`)}</span></Chip>);
    }
    if ((m.yum.quantity ?? null) !== null) chips.push(<Chip bg={bg} bd={bd} key="yum-q"><span>⚖️</span><span>{m.yum.quantity}</span><span style={{ color: '#777' }}>ml</span></Chip>);
  }
  if ((ev.event_type === 'MyMood' || ev.event_type === 'BabyMood') && m.mood) {
    chips.push(<Chip bg={bg} bd={bd} key="mood"><span>{m.mood}</span></Chip>);
  }
  if (ev.event_type === 'KickMe' && m.kick) {
    if ('count' in m.kick) chips.push(<Chip bg={bg} bd={bd} key="kick-c"><span>🦶</span><span>x{m.kick.count}</span></Chip>);
    if ('side' in m.kick) {
      const sideLabel = m.kick.side === 'L' ? t('val.left') : (m.kick.side === 'R' ? t('val.right') : t('val.middle'));
      const sideEmoji = m.kick.side === 'L' ? '⬅️' : (m.kick.side === 'R' ? '➡️' : '⬆️');
      chips.push(<Chip bg={bg} bd={bd} key="kick-s"><span>{sideEmoji}</span><span>{sideLabel}</span></Chip>);
    }
  }
  if (ev.event_type === 'Contraction' && m.contraction) {
    if ('duration_sec' in m.contraction) chips.push(<Chip bg={bg} bd={bd} key="con-d"><span>⏱️</span><span>{m.contraction.duration_sec}s</span></Chip>);
    if ('intensity' in m.contraction) chips.push(<Chip bg={bg} bd={bd} key="con-i"><span>🔥</span><span>{m.contraction.intensity}/10</span></Chip>);
  }
  if (ev.event_type === 'Temperature' && m.temp) {
    const unit = (m.temp.unit || 'F').toUpperCase();
    const val = m.temp.value;
    if (val !== undefined) chips.push(<Chip bg={bg} bd={bd} key="temp"><span>🌡️</span><span>{val}°{unit}</span></Chip>);
  }
  if (ev.event_type === 'Medicine' && m.medicine) {
    if (m.medicine.name) chips.push(<Chip bg={bg} bd={bd} key="med-n"><span>💊</span><span>{m.medicine.name}</span></Chip>);
    if (m.medicine.dose !== undefined) chips.push(<Chip bg={bg} bd={bd} key="med-d"><span>⚖️</span><span>{m.medicine.dose}{m.medicine.unit ? (' ' + m.medicine.unit) : ''}</span></Chip>);
    if (m.medicine.route) chips.push(<Chip bg={bg} bd={bd} key="med-r"><span>➡️</span><span>{t(`val.${m.medicine.route.toLowerCase()}`) || m.medicine.route}</span></Chip>);
  }
  if (ev.event_type === 'Doctor' && m.doctor) {
    const kind = t(`val.${m.doctor.kind}`) || m.doctor.kind || 'Visit';
    const who = m.doctor.provider ? `· ${m.doctor.provider}` : '';
    chips.push(<Chip bg={bg} bd={bd} key="doc"><span>🩺</span><span>{kind}{who}</span></Chip>);
  }
  if (ev.event_type === 'Heartbeat' && m.heartbeat) {
    if (m.heartbeat.bpm !== undefined) chips.push(<Chip bg={bg} bd={bd} key="hb"><span>❤️</span><span>{m.heartbeat.bpm} bpm</span></Chip>);
  }
  if (ev.event_type === 'Play' && m.play) {
    const em = { tummy: '🤸', reading: '📚', walk: '🚶', music: '🎶', bath: '🛁' }[m.play.kind];
    const label = t(`val.${m.play.kind}`) || m.play.kind;
    chips.push(<Chip bg={bg} bd={bd} key="play-k"><span>{em || '🎲'}</span><span>{label}</span></Chip>);
    if (m.play.duration_min !== undefined) chips.push(<Chip bg={bg} bd={bd} key="play-d"><span>⏱️</span><span>{m.play.duration_min}m</span></Chip>);
  }
  if (ev.event_type === 'Milestone' && m.milestone) {
    const cat = t(`val.${m.milestone.category}`) || null;
    if (m.milestone.title) chips.push(<Chip bg={bg} bd={bd} key="mile-t"><span>⭐</span><span>{m.milestone.title}</span></Chip>);
    if (cat) chips.push(<Chip bg={bg} bd={bd} key="mile-c"><span>🏷️</span><span>{cat}</span></Chip>);
  }
  if (ev.event_type === 'Measure' && m.measure) {
    const kind = t(`val.${m.measure.kind}`) || m.measure.kind;
    if (m.measure.inches !== undefined) {
      chips.push(<Chip bg={bg} bd={bd} key="meas"><span>📏</span><span>{kind}</span><span>{m.measure.inches} in</span></Chip>);
    } else if (m.measure.lb !== undefined || m.measure.oz !== undefined) {
      const lb = m.measure.lb || 0;
      const oz = m.measure.oz || 0;
      chips.push(<Chip bg={bg} bd={bd} key="meas"><span>⚖️</span><span>{kind}</span><span>{lb}lb {oz}oz</span></Chip>);
    }
  }
  if (ev.event_type === 'Puke' && m.puke) {
    const a = m.puke.amount;
    const em = a === 'small' ? '💧' : a === 'medium' ? '💦' : '🌊';
    chips.push(<Chip bg={bg} bd={bd} key="puke"><span>🤮</span>{a ? <><span>{em}</span><span>{t(`val.${a}`)}</span></> : null}</Chip>);
  }
  if (ev.event_type === 'Sick') {
    chips.push(<Chip bg={bg} bd={bd} key="sick"><span>🤒</span><span>{t('event.sick')}</span></Chip>);
  }
  if (ev.event_type === 'SleepStart') {
    chips.push(<Chip bg={bg} bd={bd} key="sstart"><span>🛌</span><span>Start</span></Chip>);
  }
  if (ev.event_type === 'SleepEnd' && m.sleep) {
    if (m.sleep.duration_min !== undefined) chips.push(<Chip bg={bg} bd={bd} key="send"><span>🛌</span><span>End</span><span>·</span><span>{m.sleep.duration_min}m</span></Chip>);
    else chips.push(<Chip bg={bg} bd={bd} key="send"><span>🛌</span><span>End</span></Chip>);
  }
  if (ev.event_type === 'CryCry') chips.push(<Chip bg={bg} bd={bd} key="cry"><span>😭</span><span>{t('event.crycry')}</span></Chip>);
  if (ev.event_type === 'BlahBlah') chips.push(<Chip bg={bg} bd={bd} key="blah"><span>🗣️</span><span>{t('event.blahblah')}</span></Chip>);

  if (chips.length === 0) return null;
  return <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, marginLeft: 8 }}>{chips}</span>;
}

export default function LogPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const { user, babies, selectedBabyId, refreshBabies, role } = useBaby();
  const { t } = useLanguage();
  const [events, setEvents] = useState([]);
  const [hoverId, setHoverId] = useState('');
  const [buttonConfig, setButtonConfig] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const hoverTimerRef = useRef(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef(null);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState(null);

  // Bottom sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null); // full event row
  const [activeType, setActiveType] = useState(null);
  const [metaDraft, setMetaDraft] = useState({}); // per-type + optional top-level notes
  const [overrideTimestamp, setOverrideTimestamp] = useState('');
  const [sheetLoading, setSheetLoading] = useState(false);

  useEffect(() => {
    if (editingEvent?.occurred_at) {
      setOverrideTimestamp(toDateTimeLocalString(new Date(editingEvent.occurred_at)));
    } else {
      setOverrideTimestamp('');
    }
  }, [editingEvent?.id, editingEvent?.occurred_at]);

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
      setHasMore(true);
    }
    // Reset filter when baby changes
    setFilterType(null);
    setShowFilters(false);
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
    } catch { }
  }

  async function fetchEvents(babyId, cursor = null) {
    const PAGE_SIZE = 20;
    let query = supabase.from('events')
      .select('*')
      .eq('baby_id', babyId)
      .order('occurred_at', { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (cursor) {
      query = query.lt('occurred_at', cursor);
    }

    const { data, error } = await query;
    if (error) { console.error('fetchEvents error', error); return; }

    const hasMoreResults = (data || []).length > PAGE_SIZE;
    const eventsData = hasMoreResults ? data.slice(0, PAGE_SIZE) : (data || []);

    if (cursor) {
      setEvents(prev => [...prev, ...eventsData]);
    } else {
      setEvents(eventsData);
    }
    setHasMore(hasMoreResults);
  }

  async function loadMore() {
    if (!selectedBaby || loadingMore || !hasMore) return;
    const oldest = events[events.length - 1]?.occurred_at;
    if (!oldest) return;

    setLoadingMore(true);
    await fetchEvents(selectedBaby.id, oldest);
    setLoadingMore(false);
  }

  const EVENT_DEFS = useMemo(() => {
    if (!configLoaded) return [];
    return applyButtonConfig(BASE_EVENT_DEFS, buttonConfig);
  }, [buttonConfig, configLoaded]);

  // Get unique event types from loaded events for filter chips
  const eventTypesInList = useMemo(() => {
    const types = new Set(events.map(ev => ev.event_type));
    return Array.from(types);
  }, [events]);

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, events.length]);

  async function logEvent(type) {
    if (role === 'viewer') return alert(t('share.viewer_no_edit') || 'Viewers cannot create events.');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert(t('log.please_signin'));
    if (!selectedBaby) return alert(t('log.please_select_baby'));
    setSheetLoading(true);
    const now = new Date();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) { setSheetLoading(false); return alert('Missing session token.'); }
    setActiveType(type);
    const defaultDraft =
      type === 'DooDoo' ? { doo: { consistency: 'normal', color: 'yellow' }, notes: '' } :
        type === 'PeePee' ? { pee: { amount: 'medium' }, notes: '' } :
          type === 'Diaper' ? { diaper: { kind: 'wet' }, notes: '' } :
            type === 'YumYum' ? { yum: { kind: 'bottle', quantity: 60 }, notes: '' } :
              type === 'MyMood' ? { mood: '🙂', notes: '' } :
                type === 'BabyMood' ? { mood: '🙂', notes: '' } :
                  type === 'KickMe' ? { kick: { count: 1, side: 'M' }, notes: '' } :
                    type === 'Contraction' ? { contraction: { intensity: 5, duration_sec: 30 }, notes: '' } :
                      type === 'Temperature' ? { temp: { unit: 'F', value: 98.6 }, notes: '' } :
                        type === 'Medicine' ? { medicine: { name: '', dose: 0, unit: 'mg', route: 'PO' }, notes: '' } :
                          type === 'Doctor' ? { doctor: { kind: 'pediatrician', provider: '' }, notes: '' } :
                            type === 'Heartbeat' ? { heartbeat: { bpm: 140 }, notes: '' } :
                              type === 'Play' ? { play: { kind: 'tummy', duration_min: 10 }, notes: '' } :
                                type === 'Milestone' ? { milestone: { title: '', category: 'first' }, notes: '' } :
                                  type === 'Note' ? { notes: '' } :
                                    type === 'Puke' ? { puke: { amount: 'small' }, notes: '' } :
                                      type === 'SleepEnd' ? { sleep: { duration_min: 60 }, notes: '' } :
                                        { notes: '' };
    setMetaDraft(defaultDraft);
    const optimisticEvent = { id: 'pending', event_type: type, occurred_at: now.toISOString(), meta: {} };
    setEditingEvent(optimisticEvent);
    setOverrideTimestamp(toDateTimeLocalString(now));
    setSheetOpen(true);

    try {
      const res = await fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ baby_id: selectedBaby.id, event_type: type }) });
      if (!res.ok) {
        console.error('logEvent error', await res.json().catch(() => ({})));
        alert(t('log.failed_log'));
        setSheetOpen(false);
        setEditingEvent(null);
        setActiveType(null);
        setSheetLoading(false);
        return;
      }
      const { event } = await res.json();
      setEvents(prev => [event, ...prev]);
      setEditingEvent(event);
      setOverrideTimestamp(toDateTimeLocalString(new Date(event.occurred_at || Date.now())));
    } catch (err) {
      console.error('logEvent exception', err);
      alert(t('log.failed_log'));
      setSheetOpen(false);
      setEditingEvent(null);
      setActiveType(null);
    } finally {
      setSheetLoading(false);
    }
  }

  async function deleteEvent(id) {
    if (role === 'viewer') return alert(t('share.viewer_no_edit') || 'Viewers cannot delete events.');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch(`/api/events/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
    if (!res.ok && res.status !== 204) { console.error('deleteEvent error', await res.json().catch(() => ({}))); alert(t('log.failed_delete')); return; }
    setEvents(prev => prev.filter(e => e.id !== id));
    if (editingEvent?.id === id) { setSheetOpen(false); setEditingEvent(null); setActiveType(null); }
  }

  function openEditEvent(ev) {
    if (role === 'viewer') return alert(t('share.viewer_no_edit') || 'Viewers cannot edit events.');
    const type = ev.event_type;
    setActiveType(type);
    // Load existing meta data, with notes extracted to top level
    const existingMeta = ev.meta || {};
    const notes = extractNotes(existingMeta);
    setMetaDraft({ ...existingMeta, notes });
    setEditingEvent(ev);
    setOverrideTimestamp(toDateTimeLocalString(new Date(ev.occurred_at)));
    setSheetOpen(true);
  }

  async function saveMeta() {
    if (!editingEvent) return;
    if (role === 'viewer') return alert(t('share.viewer_no_edit') || 'Viewers cannot edit events.');
    if (editingEvent.id === 'pending') return; // still awaiting creation
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const payload = { meta: metaDraft };
    if (overrideTimestamp) {
      const parsed = parseDateTimeLocalString(overrideTimestamp);
      if (parsed) payload.occurred_at = parsed.toISOString();
    }
    const res = await fetch(`/api/events/${editingEvent.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    if (!res.ok) { console.error('updateEvent error', await res.json().catch(() => ({}))); alert(t('log.failed_save')); return; }
    const { event } = await res.json();
    setEvents(prev => prev.map(e => e.id === event.id ? event : e));
    setSheetOpen(false); setEditingEvent(null); setActiveType(null);
    setOverrideTimestamp('');
  }

  async function sendOtpCode(e) {
    e.preventDefault();
    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true }
      });
      if (error) throw error;
      setOtpSent(true);
    } catch (err) { console.error(err); alert(t('log.failed_send')); }
    finally { setSending(false); }
  }

  async function verifyOtpCode(e) {
    e.preventDefault();
    setVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email'
      });
      if (error) throw error;
      // Auth state change listener will handle the redirect
    } catch (err) {
      console.error(err);
      alert(t('log.wrong_code'));
    }
    finally { setVerifying(false); }
  }

  function resetOtpFlow() {
    setOtpSent(false);
    setOtpCode('');
  }

  const showTrash = (id) => hoverId === id && role !== 'viewer';
  const onTouch = (id) => {
    setHoverId(id);
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHoverId(''), 2000);
  };

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <h2>{t('log.welcome')}</h2>
        {!otpSent ? (
          <>
            <p>{t('log.enter_email')}</p>
            <form onSubmit={sendOtpCode} style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <input type="email" required value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #ccc', minWidth: 260, fontSize: 16 }} />
              <button type="submit" disabled={sending} style={{ padding: '12px 14px', borderRadius: 12, background: '#c7f0d8', border: '1px solid #73c69c', cursor: sending ? 'wait' : 'pointer', fontWeight: 700, opacity: sending ? 0.7 : 1 }}>{sending ? t('log.sending') : t('log.send_code')}</button>
            </form>
          </>
        ) : (
          <>
            <p style={{ color: '#059669', marginBottom: 8 }}>{t('log.code_sent')}</p>
            <p>{t('log.enter_code')}</p>
            <form onSubmit={verifyOtpCode} style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={otpCode}
                placeholder="000000"
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #ccc', width: 120, fontSize: 20, letterSpacing: 4, textAlign: 'center', fontFamily: 'monospace' }}
              />
              <button type="submit" disabled={verifying || otpCode.length !== 6} style={{ padding: '12px 14px', borderRadius: 12, background: '#c7f0d8', border: '1px solid #73c69c', cursor: (verifying || otpCode.length !== 6) ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: (verifying || otpCode.length !== 6) ? 0.7 : 1 }}>{verifying ? t('log.verifying') : t('log.verify')}</button>
            </form>
            <button onClick={resetOtpFlow} style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#f5f5f5', cursor: 'pointer', fontSize: 14 }}>{t('log.try_again')}</button>
          </>
        )}
      </div>
    );
  }

  const grid = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(130px, 45%), 1fr))', gap: 10, paddingTop: 6 }}>
      {EVENT_DEFS.map((def, index) => (
        <IconButton key={def.type} emoji={def.emoji} label={t(`event.${def.type.toLowerCase()}`) || def.label} color={def.bg} border={def.bd} onClick={() => logEvent(def.type)} animationDelay={index * 30} />
      ))}
    </div>
  );

  const visibleEvents = events.filter(ev => {
    // Hide MyMood from viewers
    if (role === 'viewer' && ev.event_type === 'MyMood') return false;
    // Apply type filter if set
    if (filterType && ev.event_type !== filterType) return false;
    return true;
  });

  return (
    <div style={{ display: 'grid', gap: 20, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
      <section style={{
        padding: '16px',
        border: '1px solid rgba(255, 255, 255, 0.8)',
        borderRadius: 20,
        background: 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.04)',
        display: 'grid',
        gap: 16,
        minWidth: 0,
        maxWidth: '100%',
        overflow: 'hidden'
      }}>
        {!selectedBaby && <p style={{ color: '#888' }}>{t('log.no_baby')}</p>}
        {/* Avoid flash: if config not loaded and no cache, show a light skeleton instead of full grid */}
        {role !== 'viewer' && (
          (!configLoaded && EVENT_DEFS.length === 0) ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', gap: 10 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ height: 72, borderRadius: 12, border: '1px solid #eee', background: '#f7f7f9', animation: 'pulse 1.2s ease-in-out infinite' }} />
              ))}
              <style jsx>{`@keyframes pulse { 0%{opacity:.5} 50%{opacity:1} 100%{opacity:.5} }`}</style>
            </div>
          ) : grid
        )}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 10px' }}>
            <h3 style={{
              margin: 0,
              fontFamily: 'Nunito, Inter, sans-serif',
              fontSize: 18,
              fontWeight: 800,
              color: '#1e293b',
              letterSpacing: '-0.3px',
            }}>{t('log.recent_events')}</h3>
            <button
              onClick={() => setShowFilters(prev => !prev)}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: showFilters || filterType ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(0, 0, 0, 0.08)',
                background: showFilters || filterType
                  ? 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)'
                  : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                transition: 'all 0.15s ease',
              }}
              title={t('log.filter') || 'Filter'}
            >
              <IconFilter size={18} stroke={1.5} color={filterType ? '#7c3aed' : '#64748b'} />
              {filterType && <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>1</span>}
            </button>
          </div>
          {showFilters && (
            <div style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 12,
              paddingBottom: 12,
              borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            }}>
              <button
                onClick={() => setFilterType(null)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: !filterType ? '2px solid #8b5cf6' : '1px solid rgba(0, 0, 0, 0.1)',
                  background: !filterType
                    ? 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)'
                    : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: !filterType ? '#7c3aed' : '#475569',
                  boxShadow: !filterType ? '0 2px 8px rgba(139, 92, 246, 0.2)' : '0 1px 4px rgba(0, 0, 0, 0.04)',
                  transition: 'all 0.15s ease',
                }}
              >
                {t('log.filter_all') || 'All'}
              </button>
              {eventTypesInList.map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(filterType === type ? null : type)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: filterType === type ? '2px solid #8b5cf6' : '1px solid rgba(0, 0, 0, 0.1)',
                    background: filterType === type
                      ? 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)'
                      : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontWeight: 600,
                    color: filterType === type ? '#7c3aed' : '#475569',
                    boxShadow: filterType === type ? '0 2px 8px rgba(139, 92, 246, 0.2)' : '0 1px 4px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t(`event.${type.toLowerCase()}`) || type}
                </button>
              ))}
            </div>
          )}
          {visibleEvents.length === 0 ? <p style={{ color: '#64748b', textAlign: 'center', padding: '20px 0' }}>{t('log.no_events')}</p> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, overflow: 'hidden' }}>
              {visibleEvents.map(ev => {
                const notes = extractNotes(ev?.meta);
                const isHovered = hoverId === ev.id;
                const eventColor = EVENT_COLORS[ev.event_type] || { bg: '#f5f5f7', bd: '#e8e8ee' };
                return (
                  <li
                    key={ev.id}
                    onMouseEnter={() => setHoverId(ev.id)}
                    onMouseLeave={() => setHoverId('')}
                    onTouchStart={() => onTouch(ev.id)}
                    style={{
                      position: 'relative',
                      padding: '14px 16px 14px 20px',
                      borderTop: isHovered ? '1px solid rgba(139, 92, 246, 0.2)' : '1px solid rgba(0, 0, 0, 0.04)',
                      borderRight: isHovered ? '1px solid rgba(139, 92, 246, 0.2)' : '1px solid rgba(0, 0, 0, 0.04)',
                      borderBottom: isHovered ? '1px solid rgba(139, 92, 246, 0.2)' : '1px solid rgba(0, 0, 0, 0.04)',
                      borderLeft: `4px solid ${eventColor.bd}`,
                      borderRadius: 14,
                      marginBottom: 10,
                      background: isHovered
                        ? `linear-gradient(135deg, ${eventColor.bg}40 0%, ${eventColor.bg}20 100%)`
                        : 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)',
                      display: 'grid',
                      gap: 6,
                      minWidth: 0,
                      boxShadow: isHovered
                        ? `0 4px 16px ${eventColor.bd}30, 0 2px 6px rgba(0, 0, 0, 0.04)`
                        : '0 2px 8px rgba(0, 0, 0, 0.03)',
                      transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
                      transition: 'all 0.15s ease-out',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{
                          whiteSpace: 'nowrap',
                          color: '#1e293b',
                          fontWeight: 700,
                        }}>{t(`event.${ev.event_type.toLowerCase()}`) || ev.event_type}</strong>
                        <MetaInline ev={ev} t={t} eventColor={eventColor} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <time style={{
                          whiteSpace: 'nowrap',
                          color: '#64748b',
                          fontSize: 13,
                          fontWeight: 500,
                        }}>{new Date(ev.occurred_at).toLocaleString()}</time>
                        {role !== 'viewer' && (
                          <>
                            <button
                              aria-label="Edit"
                              title="Edit"
                              onClick={() => openEditEvent(ev)}
                              style={{
                                opacity: showTrash(ev.id) ? 1 : 0,
                                transition: 'all .15s ease',
                                padding: '6px 8px',
                                borderRadius: 8,
                                border: '1px solid rgba(139, 92, 246, 0.2)',
                                background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                color: '#7c3aed',
                              }}
                            ><IconPencil size={16} stroke={1.5} /></button>
                            <button
                              aria-label="Delete"
                              title="Delete"
                              onClick={() => deleteEvent(ev.id)}
                              style={{
                                opacity: showTrash(ev.id) ? 1 : 0,
                                transition: 'all .15s ease',
                                padding: '6px 8px',
                                borderRadius: 8,
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                                cursor: 'pointer',
                              }}
                            >🗑️</button>
                          </>
                        )}
                      </div>
                    </div>
                    {notes ? <div style={{
                      color: '#475569',
                      fontSize: 13,
                      overflowWrap: 'break-word',
                      minWidth: 0,
                      padding: '6px 10px',
                      background: 'rgba(0, 0, 0, 0.02)',
                      borderRadius: 8,
                      marginTop: 2,
                    }}>📝 {notes}</div> : null}
                  </li>
                )
              })}
            </ul>
          )}
          {hasMore && (
            <div ref={sentinelRef} style={{
              padding: 24,
              textAlign: 'center',
              color: '#8b5cf6',
              fontWeight: 500,
            }}>
              {loadingMore ? (t('log.loading') || 'Loading...') : ''}
            </div>
          )}
          {!hasMore && visibleEvents.length > 0 && (
            <div style={{
              padding: 20,
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: 13,
              fontWeight: 500,
            }}>
              {t('log.no_more_events') || 'No more events'}
            </div>
          )}
        </div>
      </section>

      <BottomSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditingEvent(null); setActiveType(null); }}
        autoHideMs={8000}
        eventType={activeType ? (t(`event.${activeType.toLowerCase()}`) || activeType) : null}
        eventColor={activeType ? EVENT_COLORS[activeType] : null}
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {activeType && <strong style={{ fontFamily: 'Nunito, Inter, sans-serif', fontSize: 15, color: '#475569' }}>{t('log.add_details')}</strong>}

          {/* Per-type editors */}
          {activeType === 'DooDoo' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[{ k: 'runny', emoji: '💧' }, { k: 'normal', emoji: '🟠' }, { k: 'firm', emoji: '🧱' }].map(opt => (
                  <Pill key={opt.k} active={metaDraft?.doo?.consistency === opt.k} onClick={() => setMetaDraft(prev => ({ ...prev, doo: { ...(prev.doo || {}), consistency: opt.k } }))}>
                    <span style={{ marginRight: 6 }}>{opt.emoji}</span>{t(`val.${opt.k}`)}
                  </Pill>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[{ k: 'yellow', emoji: '🟡' }, { k: 'green', emoji: '🟢' }, { k: 'brown', emoji: '🟤' }].map(opt => (
                  <Pill key={opt.k} active={metaDraft?.doo?.color === opt.k} onClick={() => setMetaDraft(prev => ({ ...prev, doo: { ...(prev.doo || {}), color: opt.k } }))}>
                    <span style={{ marginRight: 6 }}>{opt.emoji}</span>{t(`val.${opt.k}`)}
                  </Pill>
                ))}
              </div>
            </div>
          )}

          {activeType === 'PeePee' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[{ k: 'small', emoji: '💧' }, { k: 'medium', emoji: '💦' }, { k: 'large', emoji: '🌊' }].map(opt => (
                <Pill key={opt.k} active={metaDraft?.pee?.amount === opt.k} onClick={() => setMetaDraft(prev => ({ ...prev, pee: { amount: opt.k } }))}>
                  {opt.emoji} {t(`val.${opt.k}`)}
                </Pill>
              ))}
            </div>
          )}

          {activeType === 'Diaper' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['wet', 'dirty', 'both', 'dry'].map(k => (
                <Pill key={k} active={metaDraft?.diaper?.kind === k} onClick={() => setMetaDraft(prev => ({ ...prev, diaper: { kind: k } }))}>
                  {k === 'wet' ? '💧 ' + t('val.wet') : k === 'dirty' ? '💩 ' + t('val.dirty') : k === 'both' ? '💧💩 ' + t('val.both') : '🧷 ' + t('val.dry')}
                </Pill>
              ))}
            </div>
          )}

          {activeType === 'YumYum' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[{ k: 'breast', emoji: '🤱' }, { k: 'bottle', emoji: '🍼' }, { k: 'formula', emoji: '🥛' }, { k: 'solid', emoji: '🍎' }].map(opt => (
                  <Pill key={opt.k} active={metaDraft?.yum?.kind === opt.k} onClick={() => setMetaDraft(prev => ({ ...prev, yum: { ...(prev.yum || {}), kind: opt.k } }))}>
                    <span style={{ marginRight: 6 }}>{opt.emoji}</span>{t(`val.${opt.k}`)}
                  </Pill>
                ))}
              </div>
              {metaDraft?.yum?.kind === 'breast' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Pill active={metaDraft?.yum?.side === 'left'} onClick={() => setMetaDraft(prev => ({ ...prev, yum: { ...(prev.yum || {}), side: 'left' } }))}>
                    ⬅️ {t('val.left')}
                  </Pill>
                  <Pill active={metaDraft?.yum?.side === 'right'} onClick={() => setMetaDraft(prev => ({ ...prev, yum: { ...(prev.yum || {}), side: 'right' } }))}>
                    {t('val.right')} ➡️
                  </Pill>
                  <Pill active={metaDraft?.yum?.side === 'both'} onClick={() => setMetaDraft(prev => ({ ...prev, yum: { ...(prev.yum || {}), side: 'both' } }))}>
                    ↔️ {t('val.both')}
                  </Pill>
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{t('field.quantity')}</span>
                <input type="number" min="0" value={metaDraft?.yum?.quantity ?? 0} onChange={(e) => setMetaDraft(prev => ({ ...prev, yum: { ...(prev.yum || {}), quantity: e.target.value === '' ? '' : Number(e.target.value) } }))} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc', width: 120, fontSize: 16 }} />
                <span style={{ color: '#666' }}>ml</span>
              </label>
              <QuickButtons
                values={[30, 60, 90, 120, 150]}
                activeValue={metaDraft?.yum?.quantity}
                onSelect={(val) => setMetaDraft(prev => ({ ...prev, yum: { ...(prev.yum || {}), quantity: val } }))}
                format={(val) => `${val} ml`}
              />
            </div>
          )}

          {(activeType === 'MyMood' || activeType === 'BabyMood') && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['😄', '🙂', '😐', '😕', '😢', '😡'].map(m => (
                <button key={m} onClick={() => setMetaDraft({ ...metaDraft, mood: m })} style={{ fontSize: 24, padding: '6px 10px', borderRadius: 10, border: `2px solid ${metaDraft?.mood === m ? '#444' : '#ddd'}`, background: '#fff' }}>{m}</button>
              ))}
            </div>
          )}

          {activeType === 'KickMe' && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <label>{t('field.count')}
                <input type="number" min="1" value={metaDraft?.kick?.count ?? 1} onChange={(e) => setMetaDraft(prev => ({ ...prev, kick: { ...(prev.kick || {}), count: e.target.value === '' ? '' : Number(e.target.value) } }))} style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc', width: 100, fontSize: 16 }} />
              </label>
              <QuickButtons
                values={[1, 2, 3, 5, 8]}
                activeValue={metaDraft?.kick?.count}
                onSelect={(val) => setMetaDraft(prev => ({ ...prev, kick: { ...(prev.kick || {}), count: val } }))}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Pill active={metaDraft?.kick?.side === 'L'} onClick={() => setMetaDraft(prev => ({ ...prev, kick: { ...(prev.kick || {}), side: 'L' } }))}>⬅️ {t('val.left')}</Pill>
                <Pill active={metaDraft?.kick?.side === 'M'} onClick={() => setMetaDraft(prev => ({ ...prev, kick: { ...(prev.kick || {}), side: 'M' } }))}>⬆️ {t('val.middle')}</Pill>
                <Pill active={metaDraft?.kick?.side === 'R'} onClick={() => setMetaDraft(prev => ({ ...prev, kick: { ...(prev.kick || {}), side: 'R' } }))}>{t('val.right')} ➡️</Pill>
              </div>
            </div>
          )}

          {activeType === 'Contraction' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <label>{t('tools.intensity')} (1–10)
                <input type="number" min="1" max="10" value={metaDraft?.contraction?.intensity ?? 5} onChange={(e) => setMetaDraft(prev => ({ ...prev, contraction: { ...(prev.contraction || {}), intensity: e.target.value === '' ? '' : Number(e.target.value) } }))} style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc', width: 120, fontSize: 16 }} />
              </label>
              <QuickButtons
                values={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                activeValue={metaDraft?.contraction?.intensity}
                onSelect={(val) => setMetaDraft(prev => ({ ...prev, contraction: { ...(prev.contraction || {}), intensity: val } }))}
              />
              <label>{t('tools.duration')} (sec)
                <input type="number" min="0" value={metaDraft?.contraction?.duration_sec ?? 30} onChange={(e) => setMetaDraft(prev => ({ ...prev, contraction: { ...(prev.contraction || {}), duration_sec: e.target.value === '' ? '' : Number(e.target.value) } }))} style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc', width: 120, fontSize: 16 }} />
              </label>
              <QuickButtons
                values={[30, 45, 60, 90, 120]}
                activeValue={metaDraft?.contraction?.duration_sec}
                onSelect={(val) => setMetaDraft(prev => ({ ...prev, contraction: { ...(prev.contraction || {}), duration_sec: val } }))}
                format={(val) => `${val}s`}
              />
            </div>
          )}

          {activeType === 'Temperature' && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <label>{t('field.value')}
                <input type="number" step="0.1" value={metaDraft?.temp?.value ?? 98.6} onChange={(e) => setMetaDraft(prev => ({ ...prev, temp: { ...(prev.temp || { unit: 'F' }), value: e.target.value === '' ? '' : Number(e.target.value) } }))} style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc', width: 120, fontSize: 16 }} />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Pill active={(metaDraft?.temp?.unit || 'F') === 'F'} onClick={() => setMetaDraft(prev => ({ ...prev, temp: { ...(prev.temp || {}), unit: 'F' } }))}>°F</Pill>
                <Pill active={(metaDraft?.temp?.unit || 'F') === 'C'} onClick={() => setMetaDraft(prev => ({ ...prev, temp: { ...(prev.temp || {}), unit: 'C' } }))}>°C</Pill>
              </div>
              <QuickButtons
                values={(metaDraft?.temp?.unit || 'F') === 'C' ? [36.5, 37, 37.5, 38] : [97, 98.6, 99.5, 100.4]}
                activeValue={metaDraft?.temp?.value}
                onSelect={(val) => setMetaDraft(prev => ({ ...prev, temp: { ...(prev.temp || { unit: 'F' }), value: val } }))}
                format={(val) => `${val}°${(metaDraft?.temp?.unit || 'F')}`}
              />
            </div>
          )}

          {activeType === 'Medicine' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <label>{t('field.name')}
                <input value={metaDraft?.medicine?.name || ''} onChange={(e) => setMetaDraft(prev => ({ ...prev, medicine: { ...(prev.medicine || {}), name: e.target.value } }))} placeholder="e.g., Acetaminophen" style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc', width: '100%', fontSize: 16 }} />
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <label>{t('field.dose')}
                  <input type="number" step="0.1" min="0" value={metaDraft?.medicine?.dose ?? 0} onChange={(e) => setMetaDraft(prev => ({ ...prev, medicine: { ...(prev.medicine || {}), dose: e.target.value === '' ? '' : Number(e.target.value) } }))} style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc', width: 120, fontSize: 16 }} />
                </label>
                <QuickButtons
                  values={[0.5, 1, 2.5, 5, 7.5]}
                  activeValue={metaDraft?.medicine?.dose}
                  onSelect={(val) => setMetaDraft(prev => ({ ...prev, medicine: { ...(prev.medicine || {}), dose: val } }))}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  {['mg', 'ml', 'drops'].map(u => (
                    <Pill key={u} active={(metaDraft?.medicine?.unit || 'mg') === u} onClick={() => setMetaDraft(prev => ({ ...prev, medicine: { ...(prev.medicine || {}), unit: u } }))}>{u}</Pill>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ k: 'PO', label: 'Oral' }, { k: 'Topical', label: 'Topical' }, { k: 'Other', label: 'Other' }].map(r => (
                    <Pill key={r.k} active={(metaDraft?.medicine?.route || 'PO') === r.k} onClick={() => setMetaDraft(prev => ({ ...prev, medicine: { ...(prev.medicine || {}), route: r.k } }))}>{t(`val.${r.k.toLowerCase()}`)}</Pill>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeType === 'Doctor' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[{ k: 'pediatrician', label: 'Pediatrician' }, { k: 'obgyn', label: 'OB‑GYN' }, { k: 'family', label: 'Family/GP' }, { k: 'urgent', label: 'Urgent Care' }].map(d => (
                  <Pill key={d.k} active={(metaDraft?.doctor?.kind || 'pediatrician') === d.k} onClick={() => setMetaDraft(prev => ({ ...prev, doctor: { ...(prev.doctor || {}), kind: d.k } }))}>{t(`val.${d.k}`)}</Pill>
                ))}
              </div>
              <label>{t('field.provider')}
                <input value={metaDraft?.doctor?.provider || ''} onChange={(e) => setMetaDraft(prev => ({ ...prev, doctor: { ...(prev.doctor || {}), provider: e.target.value } }))} placeholder="Dr. Smith" style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc', width: '100%', fontSize: 16 }} />
              </label>
            </div>
          )}

          {activeType === 'Heartbeat' && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <label>{t('field.bpm')}
                <input type="number" min="0" value={metaDraft?.heartbeat?.bpm ?? 140} onChange={(e) => setMetaDraft(prev => ({ ...prev, heartbeat: { ...(prev.heartbeat || {}), bpm: e.target.value === '' ? '' : Number(e.target.value) } }))} style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc', width: 140, fontSize: 16 }} />
              </label>
              <QuickButtons
                values={[110, 120, 130, 140, 150]}
                activeValue={metaDraft?.heartbeat?.bpm}
                onSelect={(val) => setMetaDraft(prev => ({ ...prev, heartbeat: { ...(prev.heartbeat || {}), bpm: val } }))}
                format={(val) => `${val} bpm`}
              />
            </div>
          )}

          {activeType === 'Play' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[{ k: 'tummy', label: 'Tummy Time', emoji: '🤸' }, { k: 'reading', label: 'Reading', emoji: '📚' }, { k: 'walk', label: 'Walk', emoji: '🚶' }, { k: 'music', label: 'Music', emoji: '🎶' }, { k: 'bath', label: 'Bath', emoji: '🛁' }].map(p => (
                  <Pill key={p.k} active={(metaDraft?.play?.kind || 'tummy') === p.k} onClick={() => setMetaDraft(prev => ({ ...prev, play: { ...(prev.play || {}), kind: p.k } }))}>{p.emoji} {t(`val.${p.k}`)}</Pill>
                ))}
              </div>
              <label>{t('field.duration')} (min)
                <input type="number" min="0" value={metaDraft?.play?.duration_min ?? 10} onChange={(e) => setMetaDraft(prev => ({ ...prev, play: { ...(prev.play || {}), duration_min: e.target.value === '' ? '' : Number(e.target.value) } }))} style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc', width: 160, fontSize: 16 }} />
              </label>
              <QuickButtons
                values={[10, 15, 20, 30, 45]}
                activeValue={metaDraft?.play?.duration_min}
                onSelect={(val) => setMetaDraft(prev => ({ ...prev, play: { ...(prev.play || {}), duration_min: val } }))}
                format={(val) => `${val} min`}
              />
            </div>
          )}

          {activeType === 'Milestone' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <label>{t('field.title')}
                <input value={metaDraft?.milestone?.title || ''} onChange={(e) => setMetaDraft(prev => ({ ...prev, milestone: { ...(prev.milestone || {}), title: e.target.value } }))} placeholder="e.g., First Smile" style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc', width: '100%', fontSize: 16 }} />
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[{ k: 'first', label: 'Firsts' }, { k: 'motor', label: 'Motor' }, { k: 'social', label: 'Social' }, { k: 'language', label: 'Language' }].map(m => (
                  <Pill key={m.k} active={(metaDraft?.milestone?.category || 'first') === m.k} onClick={() => setMetaDraft(prev => ({ ...prev, milestone: { ...(prev.milestone || {}), category: m.k } }))}>{t(`val.${m.k}`)}</Pill>
                ))}
              </div>
            </div>
          )}

          {activeType === 'Measure' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[{ k: 'baby_length', label: 'Baby Length' }, { k: 'head_circumference', label: 'Head Circumference' }, { k: 'baby_weight', label: 'Baby Weight' }, { k: 'mom_weight', label: 'Mom Weight' }, { k: 'mom_belly', label: 'Mom Belly' }, { k: 'mom_waist', label: 'Mom Waist' }].map(opt => (
                  <Pill key={opt.k} active={metaDraft?.measure?.kind === opt.k} onClick={() => setMetaDraft(prev => ({ ...prev, measure: { ...(prev.measure || {}), kind: opt.k } }))}>{t(`val.${opt.k}`)}</Pill>
                ))}
              </div>

              {(metaDraft?.measure?.kind === 'baby_weight' || metaDraft?.measure?.kind === 'mom_weight') ? (
                <div style={{ display: 'flex', gap: 12 }}>
                  <label>{t('val.lbs') || 'Lbs'}
                    <input
                      type="number" min="0"
                      value={metaDraft?.measure?.lb ?? 0}
                      onChange={(e) => setMetaDraft(prev => ({ ...prev, measure: { ...(prev.measure || {}), lb: e.target.value === '' ? '' : Number(e.target.value) } }))}
                      style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc', width: 80, fontSize: 16 }}
                    />
                  </label>
                  <label>{t('val.oz') || 'Oz'}
                    <input
                      type="number" min="0" max="16"
                      value={metaDraft?.measure?.oz ?? 0}
                      onChange={(e) => setMetaDraft(prev => ({ ...prev, measure: { ...(prev.measure || {}), oz: e.target.value === '' ? '' : Number(e.target.value) } }))}
                      style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc', width: 80, fontSize: 16 }}
                    />
                  </label>
                </div>
              ) : (
                <>
                  <label>{t('field.value')} (inches)
                    <input type="number" step="0.1" min="0" value={metaDraft?.measure?.inches ?? 20} onChange={(e) => setMetaDraft(prev => ({ ...prev, measure: { ...(prev.measure || {}), inches: e.target.value === '' ? '' : Number(e.target.value) } }))} style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc', width: 160, fontSize: 16 }} />
                  </label>
                  <QuickButtons
                    values={
                      metaDraft?.measure?.kind === 'head_circumference'
                        ? [13, 14, 15, 16, 17]
                        : metaDraft?.measure?.kind === 'mom_belly'
                          ? [30, 32, 34, 36, 38]
                          : metaDraft?.measure?.kind === 'mom_waist'
                            ? [28, 30, 32, 34, 36]
                            : [18, 20, 22, 24, 26]
                    }
                    activeValue={metaDraft?.measure?.inches}
                    onSelect={(val) => setMetaDraft(prev => ({ ...prev, measure: { ...(prev.measure || {}), inches: val } }))}
                    format={(val) => `${val}"`}
                  />
                </>
              )}
            </div>
          )}

          {activeType === 'Puke' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[{ k: 'small', emoji: '💧' }, { k: 'medium', emoji: '💦' }, { k: 'large', emoji: '🌊' }].map(opt => (
                <Pill key={opt.k} active={metaDraft?.puke?.amount === opt.k} onClick={() => setMetaDraft(prev => ({ ...prev, puke: { amount: opt.k } }))}>
                  {opt.emoji} {t(`val.${opt.k}`)}
                </Pill>
              ))}
            </div>
          )}

          {activeType === 'SleepEnd' && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <label>{t('field.duration')} (min)
                <input type="number" min="0" value={metaDraft?.sleep?.duration_min ?? 60} onChange={(e) => setMetaDraft(prev => ({ ...prev, sleep: { ...(prev.sleep || {}), duration_min: e.target.value === '' ? '' : Number(e.target.value) } }))} style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc', width: 140, fontSize: 16 }} />
              </label>
              <QuickButtons
                values={[30, 45, 60, 90, 120]}
                activeValue={metaDraft?.sleep?.duration_min}
                onSelect={(val) => setMetaDraft(prev => ({ ...prev, sleep: { ...(prev.sleep || {}), duration_min: val } }))}
                format={(val) => `${val} min`}
              />
            </div>
          )}

          {/* Shared optional notes */}
          <label style={{ display: 'grid', gap: 6 }}>
            <span>{t('tools.notes')}</span>
            <input
              value={metaDraft?.notes || ''}
              onChange={(e) => setMetaDraft(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add an optional note…"
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #ccc', fontSize: 16 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>{t('tools.timestamp')}</span>
            <input
              type="datetime-local"
              value={overrideTimestamp}
              onChange={(e) => setOverrideTimestamp(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #ccc', fontSize: 16 }}
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button
              onClick={() => editingEvent && editingEvent.id !== 'pending' && deleteEvent(editingEvent.id)}
              disabled={sheetLoading || editingEvent?.id === 'pending'}
              style={{
                padding: '12px 20px',
                borderRadius: 12,
                border: '1px solid #fecaca',
                background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                fontWeight: 600,
                fontSize: 15,
                color: '#dc2626',
                opacity: sheetLoading || editingEvent?.id === 'pending' ? 0.5 : 1,
                cursor: sheetLoading || editingEvent?.id === 'pending' ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.15)',
                transition: 'all 0.15s ease',
              }}
            >
              {t('tools.undo')}
            </button>
            <button
              onClick={saveMeta}
              disabled={sheetLoading || editingEvent?.id === 'pending'}
              style={{
                padding: '12px 28px',
                borderRadius: 12,
                border: '1px solid #86efac',
                background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                fontWeight: 600,
                fontSize: 15,
                color: '#15803d',
                opacity: sheetLoading || editingEvent?.id === 'pending' ? 0.5 : 1,
                cursor: sheetLoading || editingEvent?.id === 'pending' ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(34, 197, 94, 0.2)',
                transition: 'all 0.15s ease',
              }}
            >
              {sheetLoading ? t('tools.saving') : t('tools.save')}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
