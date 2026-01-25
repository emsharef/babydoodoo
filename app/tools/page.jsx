'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useBaby } from '@/components/BabyContext';
import { useLanguage } from '@/components/LanguageContext';
import IconButton from '@/components/IconButton';
import BottomSheet from '@/components/BottomSheet';
import * as echarts from 'echarts';
import * as XLSX from 'xlsx';
import { EVENT_DEFS } from '@/lib/events';

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
    const { user, babies, selectedBabyId, role } = useBaby();
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

    // Export State
    const [exportDateFrom, setExportDateFrom] = useState('');
    const [exportDateTo, setExportDateTo] = useState('');
    const [exportTypes, setExportTypes] = useState([]);
    const [exportFormat, setExportFormat] = useState('csv');
    const [exporting, setExporting] = useState(false);

    // Import State
    const [importPreview, setImportPreview] = useState([]);
    const [importErrors, setImportErrors] = useState([]);
    const [importing, setImporting] = useState(false);
    const [importStep, setImportStep] = useState('upload'); // 'upload' | 'preview' | 'done'
    const [importedCount, setImportedCount] = useState(0);
    const [importTimezone, setImportTimezone] = useState('local'); // 'local', 'UTC', or offset like '-05:00'
    const fileInputRef = useRef(null);
    const photoInputRef = useRef(null);

    // Photo Import State
    const [photoAnalyzing, setPhotoAnalyzing] = useState(false);
    const [photoDateHint, setPhotoDateHint] = useState(() => new Date().toISOString().slice(0, 10));

    // Common timezone options
    const TIMEZONE_OPTIONS = [
        { value: 'local', label: 'Local Time (Browser)' },
        { value: 'UTC', label: 'UTC (Zulu)' },
        { value: '-12:00', label: 'UTC-12:00' },
        { value: '-11:00', label: 'UTC-11:00' },
        { value: '-10:00', label: 'UTC-10:00 (Hawaii)' },
        { value: '-09:00', label: 'UTC-09:00 (Alaska)' },
        { value: '-08:00', label: 'UTC-08:00 (Pacific)' },
        { value: '-07:00', label: 'UTC-07:00 (Mountain)' },
        { value: '-06:00', label: 'UTC-06:00 (Central)' },
        { value: '-05:00', label: 'UTC-05:00 (Eastern)' },
        { value: '-04:00', label: 'UTC-04:00 (Atlantic)' },
        { value: '-03:00', label: 'UTC-03:00' },
        { value: '+00:00', label: 'UTC+00:00 (London)' },
        { value: '+01:00', label: 'UTC+01:00 (Paris)' },
        { value: '+02:00', label: 'UTC+02:00' },
        { value: '+03:00', label: 'UTC+03:00 (Moscow)' },
        { value: '+05:30', label: 'UTC+05:30 (India)' },
        { value: '+08:00', label: 'UTC+08:00 (China)' },
        { value: '+09:00', label: 'UTC+09:00 (Japan)' },
        { value: '+10:00', label: 'UTC+10:00 (Sydney)' },
    ];

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

    // --- Export Logic ---
    function toggleExportType(type) {
        setExportTypes(prev =>
            prev.includes(type)
                ? prev.filter(t => t !== type)
                : [...prev, type]
        );
    }

    function flattenMeta(type, meta) {
        if (!meta) return {};
        const mapping = {
            DooDoo: meta.doo,
            PeePee: meta.pee,
            Diaper: meta.diaper,
            YumYum: meta.yum,
            Contraction: meta.contraction,
            Temperature: meta.temp,
            Medicine: meta.medicine,
            Doctor: meta.doctor,
            Heartbeat: meta.heartbeat,
            Play: meta.play,
            Milestone: meta.milestone,
            Measure: meta.measure,
            Puke: meta.puke,
            BabyMood: { mood: meta.mood },
            MyMood: { mood: meta.mood },
            KickMe: meta.kick,
        };
        const nested = mapping[type];
        if (!nested) return {};
        const result = {};
        for (const [k, v] of Object.entries(nested)) {
            result[`meta_${k}`] = v;
        }
        return result;
    }

    function triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function downloadFile(rows, format, babyName) {
        const filename = `${babyName || 'baby'}_events_${new Date().toISOString().slice(0, 10)}`;

        if (format === 'json') {
            const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
            triggerDownload(blob, `${filename}.json`);
        } else if (format === 'csv' || format === 'xlsx') {
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Events');
            if (format === 'csv') {
                const csv = XLSX.utils.sheet_to_csv(ws);
                const blob = new Blob([csv], { type: 'text/csv' });
                triggerDownload(blob, `${filename}.csv`);
            } else {
                XLSX.writeFile(wb, `${filename}.xlsx`);
            }
        }
    }

    async function handleExport() {
        if (!selectedBabyId) return;
        setExporting(true);

        let query = supabase
            .from('events')
            .select('*')
            .eq('baby_id', selectedBabyId)
            .order('occurred_at', { ascending: false });

        if (exportDateFrom) query = query.gte('occurred_at', exportDateFrom);
        if (exportDateTo) query = query.lte('occurred_at', exportDateTo + 'T23:59:59');
        if (exportTypes.length > 0) query = query.in('event_type', exportTypes);

        const { data, error } = await query;
        setExporting(false);

        if (error || !data?.length) {
            alert(t('tools.no_data'));
            return;
        }

        const rows = data.map(e => ({
            id: e.id,
            type: e.event_type,
            occurred_at: e.occurred_at,
            notes: e.meta?.notes || '',
            ...flattenMeta(e.event_type, e.meta)
        }));

        const baby = babies.find(b => b.id === selectedBabyId);
        downloadFile(rows, exportFormat, baby?.name);
    }

    // --- Import Logic ---
    const ALLOWED_TYPES = [
        'DooDoo','PeePee','Diaper','YumYum',
        'SleepStart','SleepEnd',
        'Puke','Sick','Temperature','Medicine','Doctor',
        'BabyMood','MyMood','Play','Milestone','Note',
        'KickMe','Contraction','Heartbeat',
        'CryCry','BlahBlah','Measure'
    ];

    function formatLocalDateTime(date) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    function generateTemplate() {
        const headers = ['type', 'occurred_at', 'notes', 'meta_consistency', 'meta_color', 'meta_amount', 'meta_kind', 'meta_quantity', 'meta_side', 'meta_duration_sec', 'meta_intensity', 'meta_value', 'meta_unit'];
        const now = new Date();
        const hour1 = new Date(now - 3600000); // 1 hour ago
        const hour2 = new Date(now - 7200000); // 2 hours ago
        const exampleRows = [
            ['DooDoo', formatLocalDateTime(now), 'Example note', 'normal', 'brown', '', '', '', '', '', '', '', ''],
            ['PeePee', formatLocalDateTime(hour1), '', '', '', 'medium', '', '', '', '', '', '', ''],
            ['YumYum', formatLocalDateTime(hour2), '', '', '', '', 'bottle', '120', '', '', '', '', ''],
        ];
        const csv = [headers.join(','), ...exampleRows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        triggerDownload(blob, 'import_template.csv');
    }

    function unflattenMeta(type, row) {
        const meta = {};
        if (row.notes) meta.notes = row.notes;

        const metaFields = {};
        for (const [key, value] of Object.entries(row)) {
            if (key.startsWith('meta_') && value !== undefined && value !== null && value !== '') {
                const fieldName = key.replace('meta_', '');
                // Try to parse numbers
                const numVal = Number(value);
                metaFields[fieldName] = !isNaN(numVal) && value !== '' ? numVal : value;
            }
        }

        const typeToKey = {
            DooDoo: 'doo', PeePee: 'pee', Diaper: 'diaper',
            YumYum: 'yum', Contraction: 'contraction', Temperature: 'temp',
            Medicine: 'medicine', Doctor: 'doctor', Heartbeat: 'heartbeat',
            Play: 'play', Milestone: 'milestone', Measure: 'measure',
            Puke: 'puke', KickMe: 'kick'
        };

        if (typeToKey[type] && Object.keys(metaFields).length > 0) {
            meta[typeToKey[type]] = metaFields;
        }

        if ((type === 'BabyMood' || type === 'MyMood') && metaFields.mood) {
            meta.mood = metaFields.mood;
        }

        return Object.keys(meta).length > 0 ? meta : undefined;
    }

    function parseDateTime(dateStr, timezone) {
        // Check if date already has timezone info (Z, +XX:XX, -XX:XX)
        const hasTimezone = /Z$|[+-]\d{2}:\d{2}$|[+-]\d{4}$/.test(dateStr);

        if (hasTimezone) {
            // Date already has timezone, parse directly
            return new Date(dateStr);
        }

        // Normalize common date formats to ISO-like format
        // Handle "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD HH:MM" or "YYYY/MM/DD HH:MM:SS"
        let normalized = dateStr.trim().replace(/\//g, '-');

        // If there's a space, replace it with T for ISO format
        if (normalized.includes(' ')) {
            normalized = normalized.replace(' ', 'T');
        }

        if (timezone === 'local') {
            // Parse as local time - create date parts and use local Date constructor
            const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
            if (match) {
                const [, year, month, day, hour = '0', min = '0', sec = '0'] = match;
                return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(min), parseInt(sec));
            }
            return new Date(dateStr);
        } else if (timezone === 'UTC') {
            // Append Z for UTC
            return new Date(normalized + 'Z');
        } else {
            // Append the timezone offset (e.g., -05:00)
            return new Date(normalized + timezone);
        }
    }

    function handleFileSelect(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = evt.target.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

                const preview = [];
                const errors = [];

                rows.forEach((row, idx) => {
                    const type = row.type || row.Type || row.TYPE;
                    const occurredAt = row.occurred_at || row.occurredAt || row.timestamp;

                    if (!type || !occurredAt) {
                        errors.push({ row: idx + 2, message: 'Missing type or occurred_at' });
                        return;
                    }

                    if (!ALLOWED_TYPES.includes(type)) {
                        errors.push({ row: idx + 2, message: `${t('tools.invalid_type')}: ${type}` });
                        return;
                    }

                    // Parse date with timezone
                    let parsedDate;
                    try {
                        parsedDate = parseDateTime(String(occurredAt), importTimezone);
                        if (isNaN(parsedDate.getTime())) throw new Error('Invalid date');
                    } catch {
                        errors.push({ row: idx + 2, message: `Invalid date: ${occurredAt}` });
                        return;
                    }

                    preview.push({
                        event_type: type,
                        occurred_at: parsedDate.toISOString(),
                        meta: unflattenMeta(type, row),
                        _rowNum: idx + 2,
                    });
                });

                setImportPreview(preview);
                setImportErrors(errors);
                setImportStep('preview');
            } catch (err) {
                console.error('CSV parse error:', err);
                alert(t('tools.import_error'));
            }
        };
        reader.readAsBinaryString(file);
    }

    async function handleImport() {
        if (!selectedBabyId || importPreview.length === 0) return;

        setImporting(true);

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
            alert('Missing session token.');
            setImporting(false);
            return;
        }

        try {
            const res = await fetch('/api/events/bulk', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    baby_id: selectedBabyId,
                    events: importPreview.map(({ event_type, occurred_at, meta }) => ({
                        event_type,
                        occurred_at,
                        meta,
                    }))
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Import failed');
            }

            const result = await res.json();
            setImportedCount(result.imported);
            setImportStep('done');
        } catch (err) {
            console.error('Import error:', err);
            alert(t('tools.import_error') + ': ' + err.message);
        } finally {
            setImporting(false);
        }
    }

    function resetImport() {
        setImportPreview([]);
        setImportErrors([]);
        setImportStep('upload');
        setImportedCount(0);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        if (photoInputRef.current) {
            photoInputRef.current.value = '';
        }
    }

    async function handlePhotoUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert('File too large. Maximum size is 10MB.');
            return;
        }

        setPhotoAnalyzing(true);
        setImportErrors([]);

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
            alert('Please sign in first.');
            setPhotoAnalyzing(false);
            return;
        }

        // Convert to base64
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const base64 = evt.target.result.split(',')[1];
                const mediaType = file.type || 'image/jpeg';

                // Call vision API
                const res = await fetch('/api/vision/analyze', {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        image: base64,
                        media_type: mediaType,
                        date_hint: photoDateHint || new Date().toISOString().slice(0, 10),
                        timezone: importTimezone === 'local'
                            ? (() => {
                                // Get browser's timezone offset and format as ±HH:MM
                                const offset = new Date().getTimezoneOffset();
                                const sign = offset <= 0 ? '+' : '-';
                                const hrs = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
                                const mins = String(Math.abs(offset) % 60).padStart(2, '0');
                                return `${sign}${hrs}:${mins}`;
                            })()
                            : importTimezone
                    })
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || t('tools.analysis_failed'));
                }

                const { events } = await res.json();

                if (!events || events.length === 0) {
                    setImportErrors([{ row: 0, message: 'No events could be extracted from the photo. Try a clearer image or use CSV import.' }]);
                    setPhotoAnalyzing(false);
                    return;
                }

                // Format events for preview
                const preview = events.map((e, idx) => ({
                    event_type: e.event_type,
                    occurred_at: e.occurred_at,
                    meta: e.meta,
                    _rowNum: idx + 1,
                }));

                setImportPreview(preview);
                setImportStep('preview');
            } catch (err) {
                console.error('Photo analysis error:', err);
                alert(t('tools.analysis_failed') + ': ' + err.message);
            } finally {
                setPhotoAnalyzing(false);
            }
        };

        reader.onerror = () => {
            alert('Failed to read file');
            setPhotoAnalyzing(false);
        };

        reader.readAsDataURL(file);
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


    if (role === 'viewer') {
        return <div style={{ padding: 24 }}><h2>{t('share.viewer_no_access') || 'Access Denied'}</h2><p>{t('share.viewer_desc') || 'Viewers cannot access this page.'}</p></div>;
    }

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
                <button
                    onClick={() => setActiveTab('export')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        background: activeTab === 'export' ? '#e6edff' : 'transparent',
                        color: activeTab === 'export' ? '#4f7cff' : '#666',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer'
                    }}
                >
                    📤 {t('tools.export')}
                </button>
                <button
                    onClick={() => { setActiveTab('import'); resetImport(); }}
                    style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        background: activeTab === 'import' ? '#e6edff' : 'transparent',
                        color: activeTab === 'import' ? '#4f7cff' : '#666',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer'
                    }}
                >
                    📥 {t('tools.import')}
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

            {activeTab === 'export' && (
                <div style={{ display: 'grid', gap: 16 }}>
                    <div style={{ padding: 24, background: '#fff', borderRadius: 16, border: '1px solid #eee' }}>
                        <h3 style={{ margin: '0 0 16px' }}>{t('tools.export_desc')}</h3>

                        {/* Date Range */}
                        <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                            <label style={{ display: 'grid', gap: 6 }}>
                                <span style={{ fontSize: 14, fontWeight: 500 }}>{t('tools.date_from')}</span>
                                <input
                                    type="date"
                                    value={exportDateFrom}
                                    onChange={e => setExportDateFrom(e.target.value)}
                                    style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #ccc', fontSize: 14 }}
                                />
                            </label>
                            <label style={{ display: 'grid', gap: 6 }}>
                                <span style={{ fontSize: 14, fontWeight: 500 }}>{t('tools.date_to')}</span>
                                <input
                                    type="date"
                                    value={exportDateTo}
                                    onChange={e => setExportDateTo(e.target.value)}
                                    style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #ccc', fontSize: 14 }}
                                />
                            </label>
                        </div>

                        {/* Event Types Multi-Select */}
                        <div style={{ marginBottom: 20 }}>
                            <span style={{ fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 8 }}>{t('tools.event_types')}</span>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => setExportTypes([])}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: 8,
                                        border: exportTypes.length === 0 ? '2px solid #4f7cff' : '1px solid #d0d0d9',
                                        background: exportTypes.length === 0 ? '#e6edff' : '#fff',
                                        fontSize: 13,
                                        cursor: 'pointer',
                                        fontWeight: exportTypes.length === 0 ? 600 : 400
                                    }}
                                >
                                    {t('tools.all_types')}
                                </button>
                                {EVENT_DEFS.map(def => (
                                    <button
                                        key={def.type}
                                        onClick={() => toggleExportType(def.type)}
                                        style={{
                                            padding: '6px 10px',
                                            borderRadius: 8,
                                            border: exportTypes.includes(def.type) ? '2px solid #4f7cff' : '1px solid #d0d0d9',
                                            background: exportTypes.includes(def.type) ? '#e6edff' : '#fff',
                                            fontSize: 13,
                                            cursor: 'pointer',
                                            fontWeight: exportTypes.includes(def.type) ? 600 : 400
                                        }}
                                    >
                                        {def.emoji} {t(`event.${def.type.toLowerCase()}`) || def.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Format Selection */}
                        <div style={{ marginBottom: 20 }}>
                            <span style={{ fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 8 }}>{t('tools.format')}</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {['csv', 'xlsx', 'json'].map(fmt => (
                                    <button
                                        key={fmt}
                                        onClick={() => setExportFormat(fmt)}
                                        style={{
                                            padding: '10px 20px',
                                            borderRadius: 8,
                                            border: exportFormat === fmt ? '2px solid #4f7cff' : '1px solid #d0d0d9',
                                            background: exportFormat === fmt ? '#e6edff' : '#fff',
                                            fontSize: 14,
                                            cursor: 'pointer',
                                            fontWeight: exportFormat === fmt ? 600 : 400
                                        }}
                                    >
                                        {fmt.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Export Button */}
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            style={{
                                padding: '14px 28px',
                                borderRadius: 10,
                                background: exporting ? '#999' : '#4f7cff',
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: 16,
                                border: 'none',
                                cursor: exporting ? 'not-allowed' : 'pointer',
                                boxShadow: '0 4px 12px rgba(79, 124, 255, 0.3)'
                            }}
                        >
                            {exporting ? t('tools.exporting') : t('tools.export_button')}
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'import' && (
                <div style={{ display: 'grid', gap: 16 }}>
                    <div style={{ padding: 24, background: '#fff', borderRadius: 16, border: '1px solid #eee' }}>
                        {importStep === 'upload' && (
                            <>
                                <h3 style={{ margin: '0 0 16px' }}>{t('tools.import_desc')}</h3>
                                <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
                                    {t('tools.import_instructions')}
                                </p>

                                <button
                                    onClick={generateTemplate}
                                    style={{
                                        padding: '10px 16px',
                                        borderRadius: 8,
                                        border: '1px solid #4f7cff',
                                        background: '#fff',
                                        color: '#4f7cff',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        marginBottom: 20
                                    }}
                                >
                                    📄 {t('tools.download_template')}
                                </button>

                                <div style={{ marginTop: 16, marginBottom: 16 }}>
                                    <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
                                        {t('tools.timezone')}
                                    </label>
                                    <select
                                        value={importTimezone}
                                        onChange={(e) => setImportTimezone(e.target.value)}
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: 10,
                                            border: '1px solid #ccc',
                                            fontSize: 14,
                                            width: '100%',
                                            maxWidth: 300
                                        }}
                                    >
                                        {TIMEZONE_OPTIONS.map(tz => (
                                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                                        ))}
                                    </select>
                                    <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                                        {t('tools.timezone_hint')}
                                    </p>
                                </div>

                                <div style={{ marginTop: 16 }}>
                                    <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
                                        {t('tools.select_file')}
                                    </label>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".csv,.xlsx,.xls"
                                        onChange={handleFileSelect}
                                        style={{
                                            padding: '10px',
                                            border: '2px dashed #ccc',
                                            borderRadius: 10,
                                            width: '100%',
                                            cursor: 'pointer'
                                        }}
                                    />
                                </div>

                                {/* Photo Import Section */}
                                <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #eee' }}>
                                    <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>
                                        📷 {t('tools.or_upload_photo')}
                                    </h4>
                                    <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
                                        {t('tools.photo_import_desc')}
                                    </p>

                                    <div style={{ marginBottom: 16 }}>
                                        <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
                                            {t('tools.date_hint')}
                                        </label>
                                        <input
                                            type="date"
                                            value={photoDateHint}
                                            onChange={(e) => setPhotoDateHint(e.target.value)}
                                            style={{
                                                padding: '10px 12px',
                                                borderRadius: 10,
                                                border: '1px solid #ccc',
                                                fontSize: 14,
                                                width: '100%',
                                                maxWidth: 200
                                            }}
                                        />
                                        <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                                            {t('tools.date_hint_desc')}
                                        </p>
                                    </div>

                                    <div style={{ position: 'relative' }}>
                                        <input
                                            ref={photoInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handlePhotoUpload}
                                            disabled={photoAnalyzing}
                                            style={{
                                                padding: '10px',
                                                border: '2px dashed #a5d6a7',
                                                borderRadius: 10,
                                                width: '100%',
                                                cursor: photoAnalyzing ? 'not-allowed' : 'pointer',
                                                background: '#f1f8e9',
                                                opacity: photoAnalyzing ? 0.6 : 1
                                            }}
                                        />
                                        {photoAnalyzing && (
                                            <div style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                background: 'rgba(255,255,255,0.9)',
                                                borderRadius: 10,
                                                fontSize: 14,
                                                fontWeight: 500,
                                                color: '#4caf50'
                                            }}>
                                                <span style={{ marginRight: 8 }}>🔄</span>
                                                {t('tools.analyzing')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {importStep === 'preview' && (
                            <>
                                <h3 style={{ margin: '0 0 16px' }}>{t('tools.preview')}</h3>

                                {importErrors.length > 0 && (
                                    <div style={{ background: '#fff3cd', padding: 12, borderRadius: 8, marginBottom: 16, border: '1px solid #ffc107' }}>
                                        <strong style={{ color: '#856404' }}>Errors found:</strong>
                                        <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                                            {importErrors.map((err, i) => (
                                                <li key={i} style={{ color: '#856404', fontSize: 13 }}>
                                                    Row {err.row}: {err.message}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div style={{ marginBottom: 16, fontSize: 14 }}>
                                    <strong>{importPreview.length}</strong> {t('tools.rows_to_import')}
                                </div>

                                <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #eee', borderRadius: 8 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ background: '#f5f5f5' }}>
                                                <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #eee' }}>Type</th>
                                                <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #eee' }}>Date</th>
                                                <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #eee' }}>Details</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importPreview.slice(0, 50).map((row, i) => {
                                                // Format metadata for display
                                                const formatMeta = (meta, type) => {
                                                    if (!meta) return '-';
                                                    const parts = [];

                                                    // Type-specific metadata
                                                    if (meta.yum) {
                                                        if (meta.yum.kind) parts.push(meta.yum.kind);
                                                        if (meta.yum.side) parts.push(`side: ${meta.yum.side}`);
                                                        if (meta.yum.quantity) parts.push(meta.yum.quantity);
                                                    }
                                                    if (meta.doo) {
                                                        if (meta.doo.consistency) parts.push(meta.doo.consistency);
                                                        if (meta.doo.color) parts.push(meta.doo.color);
                                                    }
                                                    if (meta.pee) {
                                                        if (meta.pee.amount) parts.push(meta.pee.amount);
                                                    }
                                                    if (meta.temp) {
                                                        if (meta.temp.value) parts.push(`${meta.temp.value}°${meta.temp.unit || 'F'}`);
                                                    }
                                                    if (meta.medicine) {
                                                        if (meta.medicine.name) parts.push(meta.medicine.name);
                                                        if (meta.medicine.dose) parts.push(meta.medicine.dose);
                                                    }
                                                    if (meta.diaper) {
                                                        if (meta.diaper.pee) parts.push('pee');
                                                        if (meta.diaper.poop) parts.push('poop');
                                                    }

                                                    // Notes (shown last)
                                                    if (meta.notes) parts.push(`"${meta.notes}"`);

                                                    return parts.length > 0 ? parts.join(', ') : '-';
                                                };

                                                return (
                                                    <tr key={i}>
                                                        <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                                                            {EVENT_DEFS.find(d => d.type === row.event_type)?.emoji} {row.event_type}
                                                        </td>
                                                        <td style={{ padding: 8, borderBottom: '1px solid #eee', whiteSpace: 'nowrap' }}>
                                                            {new Date(row.occurred_at).toLocaleString()}
                                                        </td>
                                                        <td style={{ padding: 8, borderBottom: '1px solid #eee', color: '#666', maxWidth: 200 }}>
                                                            {formatMeta(row.meta, row.event_type)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    {importPreview.length > 50 && (
                                        <div style={{ padding: 8, textAlign: 'center', color: '#666', fontSize: 12 }}>
                                            ... and {importPreview.length - 50} more rows
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                                    <button
                                        onClick={resetImport}
                                        style={{
                                            padding: '12px 20px',
                                            borderRadius: 8,
                                            border: '1px solid #ccc',
                                            background: '#fff',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {t('tools.back')}
                                    </button>
                                    <button
                                        onClick={handleImport}
                                        disabled={importing || importPreview.length === 0}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: 8,
                                            background: importing ? '#999' : '#4caf50',
                                            color: '#fff',
                                            fontWeight: 700,
                                            border: 'none',
                                            cursor: importing ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        {importing ? t('tools.importing') : t('tools.confirm_import')}
                                    </button>
                                </div>
                            </>
                        )}

                        {importStep === 'done' && (
                            <div style={{ textAlign: 'center', padding: 20 }}>
                                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                                <h3 style={{ margin: '0 0 8px' }}>
                                    {t('tools.import_success').replace('{count}', importedCount)}
                                </h3>
                                <button
                                    onClick={resetImport}
                                    style={{
                                        marginTop: 16,
                                        padding: '10px 20px',
                                        borderRadius: 8,
                                        border: '1px solid #4f7cff',
                                        background: '#fff',
                                        color: '#4f7cff',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {t('tools.back')}
                                </button>
                            </div>
                        )}
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
