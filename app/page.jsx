'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useBaby } from '@/components/BabyContext';
import { useLanguage } from '@/components/LanguageContext';
import BottomSheet from '@/components/BottomSheet';
import IconButton from '@/components/IconButton';
import { IconTrash, IconCheck, IconX, IconPencil } from '@tabler/icons-react';

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
  return <button onClick={onClick} style={{ padding: '8px 12px', borderRadius: 999, border: `2px solid ${active ? '#444' : '#ddd'}`, background: active ? '#fafafa' : '#fff' }}>{children}</button>
}

function QuickButtons({ values, activeValue, onSelect, format }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {values.map(val => {
        const isActive = activeValue === val;
        return (
          <button
            key={val}
            type="button"
            onClick={() => onSelect(val)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: `1px solid ${isActive ? '#4f7cff' : '#d0d0d9'}`,
              background: isActive ? '#e6edff' : '#fff',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: isActive ? 600 : 500
            }}
          >
            {format ? format(val) : val}
          </button>
        );
      })}
    </div>
  );
}

export default function Home() {
  const { user, babies, selectedBabyId } = useBaby();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [metaDraft, setMetaDraft] = useState({});
  const [overrideTimestamp, setOverrideTimestamp] = useState('');
  const [sheetLoading, setSheetLoading] = useState(false);

  useEffect(() => {
    if (selectedBabyId) fetchEvents();
  }, [selectedBabyId]);

  useEffect(() => {
    if (editingEvent?.occurred_at) {
      setOverrideTimestamp(toDateTimeLocalString(new Date(editingEvent.occurred_at)));
    } else {
      setOverrideTimestamp('');
    }
  }, [editingEvent?.id, editingEvent?.occurred_at]);

  async function handleSignIn(e) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    setLoading(false);
    if (error) { console.error(error); alert(t('log.failed_send')); }
    else setMagicLinkSent(true);
  }

  async function fetchEvents() {
    const { data, error } = await supabase.from('events').select('*').eq('baby_id', selectedBabyId).order('occurred_at', { ascending: false }).limit(50);
    if (error) console.error('Error fetching events:', error);
    else setEvents(data || []);
  }

  async function logEvent(type, meta = {}) {
    if (!user) return alert(t('log.please_signin'));
    if (!selectedBabyId) return alert(t('log.please_select_baby'));

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');

    const now = new Date();
    const optimisticEvent = { id: 'pending', event_type: type, occurred_at: now.toISOString(), meta };
    setEvents(prev => [optimisticEvent, ...prev]);

    // If it's a type that usually needs details, open sheet immediately?
    // For now, let's just log it. User can tap to edit.
    // Actually, for things like Height/Weight/Temp, we might want to open sheet immediately.
    // But let's stick to simple logging for now.

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ baby_id: selectedBabyId, event_type: type, meta })
      });

      if (!res.ok) throw new Error('Failed to log event');
      const { event } = await res.json();
      setEvents(prev => [event, ...prev.filter(e => e.id !== 'pending')]);

      // Auto-open sheet for certain types if needed, or just let user tap.
      // Let's let user tap.
    } catch (err) {
      console.error(err);
      alert(t('log.failed_log'));
      setEvents(prev => prev.filter(e => e.id !== 'pending'));
    }
  }

  function openEditSheet(event) {
    setEditingEvent(event);
    setMetaDraft(event.meta || {});
    setSheetOpen(true);
  }

  async function saveMeta() {
    if (!editingEvent) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');

    const payload = { meta: metaDraft };
    if (overrideTimestamp) {
      const parsed = parseDateTimeLocalString(overrideTimestamp);
      if (parsed) payload.occurred_at = parsed.toISOString();
    }

    setSheetLoading(true);
    const res = await fetch(`/api/events/${editingEvent.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    setSheetLoading(false);

    if (!res.ok) { console.error('updateEvent error', await res.json().catch(() => ({}))); alert(t('log.failed_save')); return; }
    const { event } = await res.json();
    setEvents(prev => [event, ...prev.filter(e => e.id !== editingEvent.id)].sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at)));
    setSheetOpen(false); setEditingEvent(null);
    setOverrideTimestamp('');
  }

  async function deleteEvent(id) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch(`/api/events/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
    if (!res.ok && res.status !== 204) { console.error('deleteEvent error', await res.json().catch(() => ({}))); alert(t('log.failed_delete')); return; }
    setEvents(prev => prev.filter(e => e.id !== id));
    if (editingEvent?.id === id) { setSheetOpen(false); setEditingEvent(null); }
  }

  if (!user) {
    return (
      <div style={{ padding: 20, maxWidth: 400, margin: '40px auto', textAlign: 'center' }}>
        <h1>{t('log.welcome')}</h1>
        <p>{t('log.enter_email')}</p>
        {magicLinkSent ? (
          <div style={{ padding: 16, background: '#e6fffa', color: '#047481', borderRadius: 8 }}>
            {t('log.magic_link_sent')}
          </div>
        ) : (
          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ padding: 12, borderRadius: 8, border: '1px solid #ccc', fontSize: 16 }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{ padding: 12, borderRadius: 8, background: '#000', color: '#fff', fontWeight: 'bold', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? t('log.sending') : t('log.send_magic_link')}
            </button>
          </form>
        )}
      </div>
    );
  }

  if (!selectedBabyId) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>{t('log.no_baby')}</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 12 }}>
        <IconButton label={t('common.breast')} icon="🤱" color="#fce4ec" onClick={() => logEvent('BreastFeed', { side: 'L' })} />
        <IconButton label={t('common.bottle')} icon="🍼" color="#e3f2fd" onClick={() => logEvent('BottleFeed', { amount_oz: 4, formula: true })} />
        <IconButton label={t('common.wet')} icon="💧" color="#e0f7fa" onClick={() => logEvent('DiaperWet')} />
        <IconButton label={t('common.dirty')} icon="💩" color="#fff3e0" onClick={() => logEvent('DiaperDirty', { color: 'Yellow', texture: 'Normal' })} />
        <IconButton label="Sleep" icon="😴" color="#f3e5f5" onClick={() => logEvent('SleepStart')} />
        <IconButton label="Awake" icon="☀️" color="#fffde7" onClick={() => logEvent('SleepEnd')} />
      </div>

      <div>
        <h3 style={{ margin: '0 0 12px' }}>{t('log.recent_events')}</h3>
        {events.length === 0 ? (
          <div style={{ color: '#999', fontStyle: 'italic' }}>{t('log.no_events')}</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {events.map(e => (
              <div key={e.id} onClick={() => openEditSheet(e)} style={{ padding: 12, background: '#fff', borderRadius: 12, border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {e.event_type === 'BreastFeed' && `🤱 ${t('common.breast')}`}
                    {e.event_type === 'BottleFeed' && `🍼 ${t('common.bottle')}`}
                    {e.event_type === 'DiaperWet' && `💧 ${t('common.wet')}`}
                    {e.event_type === 'DiaperDirty' && `💩 ${t('common.dirty')}`}
                    {e.event_type === 'SleepStart' && '😴 Sleep'}
                    {e.event_type === 'SleepEnd' && '☀️ Awake'}
                    {e.event_type === 'KickMe' && `🦶 ${t('tools.kick_counter')}`}
                    {e.event_type === 'Contraction' && `⏱️ ${t('tools.contractions')}`}
                    {!['BreastFeed', 'BottleFeed', 'DiaperWet', 'DiaperDirty', 'SleepStart', 'SleepEnd', 'KickMe', 'Contraction'].includes(e.event_type) && e.event_type}
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {new Date(e.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {e.meta && Object.keys(e.meta).length > 0 && (
                      <span style={{ marginLeft: 8, opacity: 0.8 }}>
                        {JSON.stringify(e.meta).slice(0, 30)}{JSON.stringify(e.meta).length > 30 ? '...' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <IconPencil size={16} color="#ccc" />
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomSheet open={sheetOpen} onClose={() => { setSheetOpen(false); setEditingEvent(null); }} autoHideMs={null}>
        <div style={{ display: 'grid', gap: 10 }}>
          <strong style={{ fontFamily: 'Nunito, Inter, sans-serif' }}>{t('log.add_details')}</strong>

          {/* Dynamic fields based on event type */}
          {editingEvent?.event_type === 'BreastFeed' && (
            <>
              <label>{t('log.side')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Pill active={metaDraft?.side === 'L'} onClick={() => setMetaDraft(p => ({ ...p, side: 'L' }))}>{t('log.left')}</Pill>
                <Pill active={metaDraft?.side === 'R'} onClick={() => setMetaDraft(p => ({ ...p, side: 'R' }))}>{t('log.right')}</Pill>
              </div>
              <label>{t('tools.duration')} (min)</label>
              <QuickButtons values={[5, 10, 15, 20, 30]} activeValue={metaDraft?.duration_min} onSelect={v => setMetaDraft(p => ({ ...p, duration_min: v }))} />
            </>
          )}

          {editingEvent?.event_type === 'BottleFeed' && (
            <>
              <label>{t('log.quantity')} (oz)</label>
              <QuickButtons values={[2, 3, 4, 5, 6, 8]} activeValue={metaDraft?.amount_oz} onSelect={v => setMetaDraft(p => ({ ...p, amount_oz: v }))} />
              <label>Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Pill active={metaDraft?.formula} onClick={() => setMetaDraft(p => ({ ...p, formula: true, breast_milk: false }))}>{t('common.formula')}</Pill>
                <Pill active={metaDraft?.breast_milk} onClick={() => setMetaDraft(p => ({ ...p, formula: false, breast_milk: true }))}>{t('common.breast')}</Pill>
              </div>
            </>
          )}

          {editingEvent?.event_type === 'DiaperDirty' && (
            <>
              <label>Color</label>
              <QuickButtons values={['Yellow', 'Green', 'Brown']} activeValue={metaDraft?.color} onSelect={v => setMetaDraft(p => ({ ...p, color: v }))} />
              <label>Texture</label>
              <QuickButtons values={['Runny', 'Normal', 'Firm']} activeValue={metaDraft?.texture} onSelect={v => setMetaDraft(p => ({ ...p, texture: v }))} />
              <label>Amount</label>
              <QuickButtons values={['Small', 'Medium', 'Large']} activeValue={metaDraft?.amount} onSelect={v => setMetaDraft(p => ({ ...p, amount: v }))} />
            </>
          )}

          <label style={{ display: 'grid', gap: 6 }}>
            <span>{t('tools.notes')}</span>
            <input
              value={metaDraft?.notes || ''}
              onChange={(e) => setMetaDraft(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add an optional note…"
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #ccc' }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>{t('tools.timestamp')}</span>
            <input
              type="datetime-local"
              value={overrideTimestamp}
              onChange={(e) => setOverrideTimestamp(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #ccc' }}
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button
              onClick={() => editingEvent && editingEvent.id !== 'pending' && deleteEvent(editingEvent.id)}
              disabled={sheetLoading || editingEvent?.id === 'pending'}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ff9c9c', background: '#ffd4d4', fontWeight: 700, opacity: sheetLoading || editingEvent?.id === 'pending' ? 0.6 : 1, cursor: sheetLoading || editingEvent?.id === 'pending' ? 'not-allowed' : 'pointer' }}
            >
              {t('tools.delete')}
            </button>
            <button
              onClick={saveMeta}
              disabled={sheetLoading || editingEvent?.id === 'pending'}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #73c69c', background: '#c7f0d8', fontWeight: 700, opacity: sheetLoading || editingEvent?.id === 'pending' ? 0.6 : 1, cursor: sheetLoading || editingEvent?.id === 'pending' ? 'not-allowed' : 'pointer' }}
            >
              {sheetLoading ? t('tools.saving') : t('tools.save')}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
