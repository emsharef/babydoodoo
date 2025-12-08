'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useBaby } from '@/components/BabyContext';
import { useLanguage } from '@/components/LanguageContext';
import IconButton from '@/components/IconButton';
import BottomSheet from '@/components/BottomSheet';
import * as echarts from 'echarts';

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

function ContractionChart({ events, t }) {
    const chartRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Initialize chart
        if (!chartRef.current) {
            chartRef.current = echarts.init(containerRef.current);
        }

        const chart = chartRef.current;

        // Prepare data
        // Filter events for last 2 hours
        const now = new Date();
        const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);
        const recentEvents = events
            .filter(e => new Date(e.occurred_at) >= twoHoursAgo)
            .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));

        const data = [];

        recentEvents.forEach(e => {
            const start = new Date(e.occurred_at);
            const durationSec = e.meta?.contraction?.duration_sec || 0;
            const end = new Date(start.getTime() + durationSec * 1000);
            const intensity = e.meta?.contraction?.intensity || 0;

            data.push([start.getTime(), 0]);
            data.push([start.getTime(), intensity]);
            data.push([end.getTime(), intensity]);
            data.push([end.getTime(), 0]);
        });

        if (data.length > 0) {
            data.push([now.getTime(), 0]);
        }

        const option = {
            tooltip: {
                trigger: 'axis',
                formatter: function (params) {
                    const p = params[0];
                    if (!p) return '';
                    const date = new Date(p.value[0]);
                    return `${date.toLocaleTimeString()}<br/>${t('tools.intensity')}: ${p.value[1]}`;
                }
            },
            grid: {
                top: 20,
                right: 20,
                bottom: 20,
                left: 40,
                containLabel: true
            },
            xAxis: {
                type: 'time',
                min: twoHoursAgo.getTime(),
                max: now.getTime(),
                axisLabel: {
                    formatter: '{HH}:{mm}'
                }
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: 10,
                interval: 2
            },
            series: [
                {
                    name: t('tools.intensity'),
                    type: 'line',
                    step: 'end',
                    data: data,
                    areaStyle: {
                        opacity: 0.2
                    },
                    lineStyle: {
                        width: 2
                    },
                    symbol: 'none'
                }
            ]
        };

        chart.setOption(option);

        const handleResize = () => chart.resize();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [events, t]);

    return <div ref={containerRef} style={{ width: '100%', height: 200 }} />;
}

export default function ToolsPage() {
    const { user, babies, selectedBabyId } = useBaby();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState('kick'); // 'kick' or 'contraction'
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);

    // Contraction Timer State
    const [contractionStart, setContractionStart] = useState(null);
    const [timerDisplay, setTimerDisplay] = useState('00:00');

    // Bottom Sheet State (for editing details)
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [metaDraft, setMetaDraft] = useState({});
    const [overrideTimestamp, setOverrideTimestamp] = useState('');
    const [sheetLoading, setSheetLoading] = useState(false);

    useEffect(() => {
        if (selectedBabyId) {
            fetchEvents();
        }
    }, [selectedBabyId, activeTab]);

    useEffect(() => {
        let interval;
        if (contractionStart) {
            interval = setInterval(() => {
                const diff = Math.floor((Date.now() - contractionStart) / 1000);
                const m = Math.floor(diff / 60).toString().padStart(2, '0');
                const s = (diff % 60).toString().padStart(2, '0');
                setTimerDisplay(`${m}:${s}`);
            }, 1000);
        } else {
            setTimerDisplay('00:00');
        }
        return () => clearInterval(interval);
    }, [contractionStart]);

    useEffect(() => {
        if (editingEvent?.occurred_at) {
            setOverrideTimestamp(toDateTimeLocalString(new Date(editingEvent.occurred_at)));
        } else {
            setOverrideTimestamp('');
        }
    }, [editingEvent?.id, editingEvent?.occurred_at]);

    async function fetchEvents() {
        setLoading(true);
        const type = activeTab === 'kick' ? 'KickMe' : 'Contraction';
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('baby_id', selectedBabyId)
            .eq('event_type', type)
            .order('occurred_at', { ascending: false })
            .limit(100);

        if (error) console.error('Error fetching events:', error);
        else setEvents(data || []);
        setLoading(false);
    }

    async function logEvent(type, meta = {}) {
        if (!user) return alert(t('log.please_signin'));
        if (!selectedBabyId) return alert(t('log.please_select_baby'));

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return alert('Missing session token.');

        const now = new Date();
        const optimisticEvent = { id: 'pending', event_type: type, occurred_at: now.toISOString(), meta };

        // For contraction end, we open the sheet immediately
        if (type === 'Contraction') {
            setMetaDraft(meta);
            setEditingEvent(optimisticEvent);
            setOverrideTimestamp(toDateTimeLocalString(now));
            setSheetOpen(true);
        } else {
            // For kicks, just add it to the list optimistically
            setEvents(prev => [optimisticEvent, ...prev]);
        }

        try {
            const res = await fetch('/api/events', {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
                body: JSON.stringify({ baby_id: selectedBabyId, event_type: type, meta })
            });

            if (!res.ok) throw new Error('Failed to log event');
            const { event } = await res.json();

            if (type === 'Contraction') {
                setEditingEvent(event);
            } else {
                setEvents(prev => [event, ...prev.filter(e => e.id !== 'pending')]);
            }
        } catch (err) {
            console.error(err);
            alert(t('log.failed_save'));
            if (type !== 'Contraction') {
                setEvents(prev => prev.filter(e => e.id !== 'pending'));
            }
        }
    }

    async function saveMeta() {
        if (!editingEvent) return;
        if (editingEvent.id === 'pending') return; // still awaiting creation
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
        setEvents(prev => [event, ...prev.filter(e => e.id !== 'pending' && e.id !== event.id)].sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at)));
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


    // --- Kick Counter Logic ---
    const last10KicksTime = useMemo(() => {
        if (events.length < 10) return null;
        const sorted = [...events].sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
        const tenth = sorted[9];
        const first = sorted[0];
        const diff = new Date(first.occurred_at) - new Date(tenth.occurred_at);
        const mins = Math.floor(diff / 60000);
        return `${mins} min`;
    }, [events]);

    // --- Contraction Logic ---
    const handleContractionStart = () => {
        setContractionStart(Date.now());
    };

    const handleContractionEnd = () => {
        if (!contractionStart) return;
        const durationSec = Math.round((Date.now() - contractionStart) / 1000);
        setContractionStart(null);
        logEvent('Contraction', { contraction: { duration_sec: durationSec, intensity: 5 } });
    };

    const rule511Status = useMemo(() => {
        if (events.length < 2) return null;

        const sorted = [...events].sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));

        const wave = [];
        if (sorted.length > 0) {
            wave.push(sorted[0]);
            for (let i = 0; i < sorted.length - 1; i++) {
                const current = new Date(sorted[i].occurred_at);
                const prev = new Date(sorted[i + 1].occurred_at);
                const diffMin = (current - prev) / 60000;

                if (diffMin <= 10) {
                    wave.push(sorted[i + 1]);
                } else {
                    break;
                }
            }
        }

        if (wave.length < 2) return (
            <div style={{ fontSize: 13, background: '#f9f9f9', padding: 10, borderRadius: 8, border: '1px solid #eee', color: '#666' }}>
                {t('tools.rule_check')}: Not enough recent data.
            </div>
        );

        const waveStart = new Date(wave[wave.length - 1].occurred_at);
        const waveEnd = new Date(wave[0].occurred_at);
        const waveDurationMin = (waveEnd - waveStart) / 60000;

        const now = new Date();
        const oneHourAgo = new Date(now - 60 * 60 * 1000);

        const recentInWave = wave.filter(e => new Date(e.occurred_at) > oneHourAgo);

        let avgFreqMin = 0;
        let avgDurSec = 0;

        if (recentInWave.length > 1) {
            let totalDiff = 0;
            for (let i = 0; i < recentInWave.length - 1; i++) {
                totalDiff += (new Date(recentInWave[i].occurred_at) - new Date(recentInWave[i + 1].occurred_at));
            }
            avgFreqMin = Math.round((totalDiff / (recentInWave.length - 1)) / 60000);

            const totalDur = recentInWave.reduce((acc, e) => acc + (e.meta?.contraction?.duration_sec || 0), 0);
            avgDurSec = Math.round(totalDur / recentInWave.length);
        }

        const freqCheck = (avgFreqMin > 0 && avgFreqMin <= 5) ? "✅" : "❌";
        const durCheck = avgDurSec >= 45 ? "✅" : "❌";
        const consistencyCheck = waveDurationMin >= 60 ? "✅" : "⚠️";

        return (
            <div style={{ fontSize: 13, background: '#f0f9ff', padding: 10, borderRadius: 8, border: '1px solid #bae6fd' }}>
                <strong>{t('tools.rule_check')}:</strong>
                <ul style={{ paddingLeft: 20, margin: '4px 0 0' }}>
                    <li>{t('tools.frequency')}: {freqCheck} ({avgFreqMin || '?'} min avg)</li>
                    <li>{t('tools.duration')}: {durCheck} ({avgDurSec} sec avg)</li>
                    <li>{t('tools.consistency')}: {consistencyCheck} ({Math.round(waveDurationMin)} min)</li>
                </ul>
                {waveDurationMin < 60 && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
                        * {t('tools.wave_started')} {new Date(waveStart).toLocaleTimeString()}
                    </div>
                )}
            </div>
        );
    }, [events, t]);


    return (
        <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #eee', paddingBottom: 8 }}>
                <button
                    onClick={() => setActiveTab('kick')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        background: activeTab === 'kick' ? '#e6edff' : 'transparent',
                        color: activeTab === 'kick' ? '#4f7cff' : '#666',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer'
                    }}
                >
                    🦶 {t('tools.kick_counter')}
                </button>
                <button
                    onClick={() => setActiveTab('contraction')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        background: activeTab === 'contraction' ? '#e6edff' : 'transparent',
                        color: activeTab === 'contraction' ? '#4f7cff' : '#666',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer'
                    }}
                >
                    ⏱️ {t('tools.contractions')}
                </button>
            </div>

            {activeTab === 'kick' && (
                <div style={{ display: 'grid', gap: 16 }}>
                    <div style={{ padding: 24, background: '#fff', borderRadius: 16, border: '1px solid #eee', textAlign: 'center' }}>
                        <button
                            onClick={() => logEvent('KickMe', { kick: { count: 1, side: 'M' } })}
                            style={{
                                width: 120, height: 120, borderRadius: '50%',
                                background: '#ffeb3b', border: '4px solid #fbc02d',
                                fontSize: 48, cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}
                        >
                            🦶
                        </button>
                        <div style={{ marginTop: 16, fontSize: 14, color: '#666' }}>
                            {t('tools.tap_kick')}
                        </div>
                        {last10KicksTime && (
                            <div style={{ marginTop: 12, padding: '8px 12px', background: '#f5f5f5', borderRadius: 8, display: 'inline-block' }}>
                                <strong>{t('tools.last_10_kicks')}:</strong> {last10KicksTime}
                            </div>
                        )}
                    </div>

                    <div>
                        <h3>{t('tools.recent_kicks')}</h3>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {events.map(e => (
                                <li key={e.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{new Date(e.occurred_at).toLocaleString()}</span>
                                    <span style={{ color: '#666' }}>x{e.meta?.kick?.count || 1}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {activeTab === 'contraction' && (
                <div style={{ display: 'grid', gap: 16 }}>
                    <div style={{ padding: 24, background: '#fff', borderRadius: 16, border: '1px solid #eee', textAlign: 'center' }}>
                        <div style={{ fontSize: 48, fontFamily: 'monospace', marginBottom: 16, color: contractionStart ? '#e53935' : '#333' }}>
                            {timerDisplay}
                        </div>
                        {!contractionStart ? (
                            <button
                                onClick={handleContractionStart}
                                style={{
                                    padding: '16px 32px', borderRadius: 99,
                                    background: '#4caf50', color: '#fff',
                                    fontSize: 18, fontWeight: 700, border: 'none',
                                    cursor: 'pointer', boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
                                }}
                            >
                                {t('tools.start_contraction')}
                            </button>
                        ) : (
                            <button
                                onClick={handleContractionEnd}
                                style={{
                                    padding: '16px 32px', borderRadius: 99,
                                    background: '#e53935', color: '#fff',
                                    fontSize: 18, fontWeight: 700, border: 'none',
                                    cursor: 'pointer', boxShadow: '0 4px 12px rgba(229, 57, 53, 0.3)'
                                }}
                            >
                                {t('tools.stop_save')}
                            </button>
                        )}
                    </div>

                    {rule511Status}

                    <div style={{ background: '#fff', padding: 12, borderRadius: 16, border: '1px solid #eee' }}>
                        <h3 style={{ margin: '0 0 12px' }}>{t('tools.last_2_hours')}</h3>
                        <ContractionChart events={events} t={t} />
                    </div>

                    <div>
                        <h3>{t('tools.recent_contractions')}</h3>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {events.map(e => (
                                <li key={e.id} style={{ padding: '12px', borderBottom: '1px solid #eee', background: '#fff', borderRadius: 8, marginBottom: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <strong>{new Date(e.occurred_at).toLocaleTimeString()}</strong>
                                        <span>{e.meta?.contraction?.duration_sec}s</span>
                                    </div>
                                    <div style={{ fontSize: 13, color: '#666' }}>
                                        {t('tools.intensity')}: {e.meta?.contraction?.intensity}/10
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            <BottomSheet open={sheetOpen} onClose={() => { setSheetOpen(false); setEditingEvent(null); }} autoHideMs={null}>
                <div style={{ display: 'grid', gap: 10 }}>
                    <strong style={{ fontFamily: 'Nunito, Inter, sans-serif' }}>{t('tools.details')}</strong>

                    <label>{t('tools.intensity')} (1–10)
                        <input type="number" min="1" max="10" value={metaDraft?.contraction?.intensity || 5} onChange={(e) => setMetaDraft(prev => ({ ...prev, contraction: { ...(prev.contraction || {}), intensity: Number(e.target.value || 5) } }))} style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc', width: 120 }} />
                    </label>
                    <QuickButtons
                        values={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                        activeValue={metaDraft?.contraction?.intensity}
                        onSelect={(val) => setMetaDraft(prev => ({ ...prev, contraction: { ...(prev.contraction || {}), intensity: val } }))}
                    />
                    <label>{t('tools.duration')} (sec)
                        <input type="number" min="0" value={metaDraft?.contraction?.duration_sec || 30} onChange={(e) => setMetaDraft(prev => ({ ...prev, contraction: { ...(prev.contraction || {}), duration_sec: Number(e.target.value || 0) } }))} style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc', width: 120 }} />
                    </label>
                    <QuickButtons
                        values={[30, 45, 60, 90, 120]}
                        activeValue={metaDraft?.contraction?.duration_sec}
                        onSelect={(val) => setMetaDraft(prev => ({ ...prev, contraction: { ...(prev.contraction || {}), duration_sec: val } }))}
                        format={(val) => `${val}s`}
                    />

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
