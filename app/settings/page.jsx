'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useBaby } from '@/components/BabyContext';
import Link from 'next/link';
import { EVENT_DEFS, makeDefaultButtonConfig } from '@/lib/events';

function Row({ i, total, item, def, onToggle, onMove, disabled }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto', alignItems:'center', gap:10, padding:'10px 12px', border:'1px solid #eee', borderRadius:10, background:'#fff' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:20 }}>{def?.emoji || '🔘'}</span>
        <div>
          <div style={{ fontWeight:700 }}>{def?.label || item.type}</div>
          <div style={{ color:'#777', fontSize:12 }}>{item.type}</div>
        </div>
      </div>
      <label style={{ display:'flex', alignItems:'center', gap:8 }}>
        <input type="checkbox" checked={item.show !== false} disabled={disabled} onChange={(e)=>onToggle(i, e.target.checked)} />
        <span>{item.show !== false ? 'Shown' : 'Hidden'}</span>
      </label>
      <div style={{ display:'flex', gap:6 }}>
        <button disabled={disabled || i===0} onClick={()=>onMove(i, -1)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #ddd', background:'#f8f8f8', cursor: disabled || i===0 ? 'not-allowed':'pointer' }}>↑</button>
        <button disabled={disabled || i===total-1} onClick={()=>onMove(i, +1)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #ddd', background:'#f8f8f8', cursor: disabled || i===total-1 ? 'not-allowed':'pointer' }}>↓</button>
      </div>
      <div style={{ width:30, textAlign:'right' }}>{i+1}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, babies, selectedBabyId } = useBaby();
  const [role, setRole] = useState(null); // 'parent' | 'caregiver' | 'owner'
  const [baby, setBaby] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const canEdit = role === 'parent' || role === 'owner';
  const selectedBaby = useMemo(() => babies.find(b => b.id === selectedBabyId) || null, [babies, selectedBabyId]);

  useEffect(() => { 
    if (!user || !selectedBaby) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: babyRow, error: babyErr } = await supabase.from('babies').select('id, name, user_id, button_config').eq('id', selectedBaby.id).single();
      if (cancelled) return;
      if (babyErr) { console.error('load baby error', babyErr); setLoading(false); return; }
      setBaby(babyRow);
      // Determine role: owner or membership role for THIS user
      if (babyRow.user_id === user.id) {
        setRole('owner');
      } else {
        const { data: ms, error: mErr } = await supabase.from('memberships').select('role').eq('baby_id', selectedBaby.id).eq('user_id', user.id).maybeSingle();
        if (mErr) { console.error('load role error', mErr); }
        setRole(ms?.role || null);
      }
      const cfg = (babyRow.button_config && Array.isArray(babyRow.button_config.items)) ? babyRow.button_config : makeDefaultButtonConfig();
      // Use EVENT_DEFS as single source of truth for known types
      const knownTypes = new Set(EVENT_DEFS.map(d => d.type));
      const sanitized = cfg.items.filter(it => knownTypes.has(it.type));
      const missing = Array.from(knownTypes).filter(t => !sanitized.find(it => it.type === t)).map(t => ({ type: t, show: true }));
      const merged = [...sanitized, ...missing];
      setItems(merged);
      setDirty(false);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, selectedBabyId]);

  function onToggle(index, checked) {
    setItems(prev => {
      const copy = prev.slice();
      copy[index] = { ...copy[index], show: !!checked };
      return copy;
    });
    setDirty(true);
  }
  function onMove(index, delta) {
    setItems(prev => {
      const copy = prev.slice();
      const j = index + delta;
      if (j < 0 || j >= copy.length) return prev;
      const t = copy[index];
      copy[index] = copy[j];
      copy[j] = t;
      return copy;
    });
    setDirty(true);
  }
  async function onReset() {
    setItems(makeDefaultButtonConfig().items);
    setDirty(true);
  }
  async function onSave() {
    if (!selectedBaby) return;
    setSaving(true);
    try {
      const payload = { button_config: { items } };
      const { error } = await supabase.from('babies').update(payload).eq('id', selectedBaby.id);
      if (error) throw error;
      // cache locally to avoid flash on log page
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('button_config:' + selectedBaby.id, JSON.stringify(payload.button_config));
        }
      } catch {}
      alert('Saved!');
      setDirty(false);
    } catch (e) {
      console.error('save buttons error', e);
      alert('Failed to save. See console.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding:16, display:'grid', gap:12 }}>
      <h2 style={{ fontFamily:'Nunito, Inter, sans-serif', marginBottom:4 }}>Settings</h2>
      {!selectedBaby ? (
        <p style={{ color:'#666' }}>Select or create a baby first.</p>
      ) : (
        <div style={{ display:'grid', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <strong style={{ fontSize:16 }}>Customize Buttons for:</strong>
            <span style={{ padding:'4px 10px', background:'#f5f5f7', border:'1px solid #e8e8ee', borderRadius:999 }}>{baby?.name || '—'}</span>
            {role && <span style={{ marginLeft:8, fontSize:12, color:'#777' }}>Your role: <strong>{role}</strong></span>}
          </div>

          {!canEdit && (
            <div style={{ padding:12, border:'1px solid #ffe4a3', background:'#fff7df', borderRadius:10, color:'#7a5a00' }}>
              Only <strong>parents</strong> (or the owner) can edit button configuration. You can still view the current setup.
            </div>
          )}

          <div style={{ display:'grid', gap:8 }}>
            {loading ? <div>Loading…</div> : items.map((it, i) => {
              const def = EVENT_DEFS.find(d => d.type === it.type) || null;
              return <Row key={it.type} i={i} total={items.length} item={it} def={def} onToggle={onToggle} onMove={onMove} disabled={!canEdit} />;
            })}
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onReset} disabled={!canEdit} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #e8e5e5', background:'#fff' }}>Reset to defaults</button>
            <button onClick={onSave} disabled={!canEdit || !dirty || saving} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #73c69c', background:'#c7f0d8', fontWeight:700 }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>

          <div style={{ marginTop:8 }}>
            <Link href="/">← Back to Log</Link>
          </div>
        </div>
      )}
    </div>
  );
}
