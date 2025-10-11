'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const DAY_MS = 24 * 60 * 60 * 1000;
const MOOD_SCORES = new Map([
  ['😄', 3], ['🙂', 2], ['😐', 1], ['😕', 0], ['😢', -1], ['😡', -2],
]);
const STOP_WORDS = new Set(['the','and','that','with','have','this','from','there','about','your','into','would','could','their','been','were','them','what','when','where','after','before','because','while','also','just','really']);

export function useAnalyticsData({ babyId, from, to }) {
  const [state, setState] = useState({ loading: false, error: null, events: [] });

  useEffect(() => {
    if (!babyId || !from || !to) {
      setState(prev => ({ ...prev, loading: false, events: [] }));
      return;
    }
    let cancelled = false;
    setState(prev => ({ ...prev, loading: true, error: null }));
    (async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id,event_type,occurred_at,meta')
        .eq('baby_id', babyId)
        .gte('occurred_at', from)
        .lte('occurred_at', to)
        .order('occurred_at', { ascending: true });
      if (cancelled) return;
      if (error) {
        setState({ loading: false, error, events: [] });
      } else {
        setState({ loading: false, error: null, events: data || [] });
      }
    })();
    return () => { cancelled = true; };
  }, [babyId, from, to]);

  const analytics = useMemo(() => buildAnalytics(state.events, from, to), [state.events, from, to]);

  return { loading: state.loading, error: state.error, analytics };
}

function buildAnalytics(events, from, to) {
  if (!from || !to) {
    return emptyAnalytics();
  }
  const days = enumerateDays(from, to);

  const diapering = initDiapering(days);
  const feeding = initFeeding(days);
  const sleep = initSleep(days);
  const mood = initMood(days);
  const health = initHealth();
  const pregnancy = initPregnancy(days);
  const play = initPlay(days);
  const milestones = [];
  const notes = [];

  const feedTimes = [];

  events.forEach(event => {
    const dayKey = dayFromISO(event.occurred_at);
    const meta = event.meta || {};
    switch (event.event_type) {
      case 'DooDoo':
        diapering.total += 1;
        increment(ensureDay(diapering.perDay, dayKey, () => ({ DooDoo: 0, PeePee: 0, Diaper: 0 })), 'DooDoo');
        diapering.consistency.set(meta?.doo?.consistency || 'unknown', (diapering.consistency.get(meta?.doo?.consistency || 'unknown') || 0) + 1);
        diapering.color.set(meta?.doo?.color || 'unknown', (diapering.color.get(meta?.doo?.color || 'unknown') || 0) + 1);
        break;
      case 'PeePee':
        diapering.total += 1;
        increment(ensureDay(diapering.perDay, dayKey, () => ({ DooDoo: 0, PeePee: 0, Diaper: 0 })), 'PeePee');
        diapering.peeAmount.set(meta?.pee?.amount || 'unknown', (diapering.peeAmount.get(meta?.pee?.amount || 'unknown') || 0) + 1);
        break;
      case 'Diaper':
        diapering.total += 1;
        increment(ensureDay(diapering.perDay, dayKey, () => ({ DooDoo: 0, PeePee: 0, Diaper: 0 })), 'Diaper');
        diapering.diaperKind.set(meta?.diaper?.kind || 'change', (diapering.diaperKind.get(meta?.diaper?.kind || 'change') || 0) + 1);
        if ((meta?.diaper?.kind || '') === 'dirty') {
          diapering.lastDirty = event.occurred_at;
        }
        break;
      case 'YumYum': {
        const qty = toNumber(meta?.yum?.quantity);
        feeding.totalFeeds += 1;
        feeding.totalVolume += qty;
        feedTimes.push(new Date(event.occurred_at).getTime());
        ensureDay(feeding.volumePerDay, dayKey, () => ({ total: 0 })).total += qty;
        const kind = meta?.yum?.kind || 'unknown';
        feeding.volumeByType.set(kind, (feeding.volumeByType.get(kind) || 0) + qty);
        feeding.feedAmounts.push({ id: event.id, occurred_at: event.occurred_at, quantity: qty, kind });
        feeding.longestFeedQuantity = Math.max(feeding.longestFeedQuantity, qty);
        break;
      }
      case 'SleepStart':
        sleep.starts.push(event);
        break;
      case 'SleepEnd':
        sleep.ends.push(event);
        break;
      case 'MyMood':
      case 'BabyMood': {
        const moodEmoji = meta?.mood || meta?.mood?.emoji;
        if (moodEmoji) {
          mood.total += 1;
          mood.counts.set(moodEmoji, (mood.counts.get(moodEmoji) || 0) + 1);
          const bucket = bucketForHour(new Date(event.occurred_at).getHours());
        const dayBucket = ensureDay(mood.buckets, dayKey, () => {
          const bucket = new Map();
          ['Night', 'Morning', 'Afternoon', 'Evening'].forEach(period => {
            bucket.set(period, { sum: 0, count: 0 });
          });
          return bucket;
        });
          const entry = dayBucket.get(bucket);
          const score = MOOD_SCORES.get(moodEmoji) ?? 0;
          entry.sum += score;
          entry.count += 1;
        }
        break;
      }
      case 'Temperature': {
        const value = toNumber(meta?.temp?.value);
        if (value) {
          health.temperatureReadings.push({ id: event.id, occurred_at: event.occurred_at, value, unit: (meta?.temp?.unit || 'F').toUpperCase() });
        }
        break;
      }
      case 'Medicine':
        health.medicines.push({
          id: event.id,
          occurred_at: event.occurred_at,
          name: meta?.medicine?.name || '—',
          dose: toNumber(meta?.medicine?.dose),
          unit: meta?.medicine?.unit || '',
          route: meta?.medicine?.route || '',
        });
        break;
      case 'Doctor':
        health.doctorVisits.push({
          id: event.id,
          occurred_at: event.occurred_at,
          kind: meta?.doctor?.kind || 'visit',
          provider: meta?.doctor?.provider || '',
        });
        break;
      case 'Puke':
        health.pukeCounts.set(meta?.puke?.amount || 'unknown', (health.pukeCounts.get(meta?.puke?.amount || 'unknown') || 0) + 1);
        break;
      case 'Sick':
        health.sickCount += 1;
        break;
      case 'KickMe': {
        const count = toNumber(meta?.kick?.count, 1);
        ensureDay(pregnancy.kicksPerDay, dayKey, () => ({ value: 0 })).value += count;
        pregnancy.totalKicks += count;
        break;
      }
      case 'Contraction': {
        const duration = toNumber(meta?.contraction?.duration_sec);
        const intensity = toNumber(meta?.contraction?.intensity);
        pregnancy.contractions.push({ id: event.id, occurred_at: event.occurred_at, duration, intensity });
        if (intensity) pregnancy.avgContractionIntensity.total += intensity;
        if (intensity) pregnancy.avgContractionIntensity.count += 1;
        break;
      }
      case 'Heartbeat': {
        const bpm = toNumber(meta?.heartbeat?.bpm);
        if (bpm) {
          pregnancy.heartbeatReadings.push({ id: event.id, occurred_at: event.occurred_at, bpm });
          pregnancy.lastHeartbeat = event.occurred_at;
        }
        break;
      }
      case 'Play': {
        const duration = toNumber(meta?.play?.duration_min, 0);
        const kind = meta?.play?.kind || 'play';
        play.totalSessions += 1;
        play.totalMinutes += duration;
        ensureDay(play.minutesPerDay, dayKey, () => ({ minutes: 0 })).minutes += duration;
        play.minutesByType.set(kind, (play.minutesByType.get(kind) || 0) + duration);
        play.sessions.push({ id: event.id, occurred_at: event.occurred_at, duration, kind });
        break;
      }
      case 'Milestone':
        milestones.push({
          id: event.id,
          occurred_at: event.occurred_at,
          title: meta?.milestone?.title || 'Milestone',
          category: meta?.milestone?.category || 'general',
        });
        break;
      case 'Note':
        addNote(notes, event);
        break;
      default:
        break;
    }
    // shared note extraction for supporting charts
    if (event.event_type !== 'Note') {
      const note = extractNotes(meta);
      if (note) addNote(notes, event, note);
    }
  });

  finalizeSleep(sleep);
  feeding.avgIntervalMinutes = computeAverageInterval(feedTimes);
  feeding.volumeLine = buildLineSeries(feeding.volumePerDay, 'Total Volume');
  feeding.typePie = mapToPie(feeding.volumeByType, 'ml');
  diapering.stackedBar = buildStackedBar(diapering.perDay);
  diapering.consistencyPie = mapToPie(diapering.consistency, 'events');
  diapering.diaperKindPie = mapToPie(diapering.diaperKind, 'events');
  mood.emojiBar = mapToBar(mood.counts, 'count');
  mood.heatmap = buildMoodHeatmap(mood.buckets, days);
  health.temperatureLine = buildTemperatureLine(health.temperatureReadings);
  health.pukePie = mapToPie(health.pukeCounts, 'events');
  pregnancy.kicksLine = buildLineSeries(pregnancy.kicksPerDay, 'Kicks');
  pregnancy.avgContractionIntensity.value = pregnancy.avgContractionIntensity.count ? (pregnancy.avgContractionIntensity.total / pregnancy.avgContractionIntensity.count) : 0;
  play.minutesLine = buildLineSeries(play.minutesPerDay, 'Minutes');
  play.minutesByTypeBar = mapToBar(play.minutesByType, 'minutes');
  const keywordSummary = computeKeywordSummary(notes);

  return {
    totals: {
      totalEvents: events.length,
      dayCount: days.length,
      from,
      to,
    },
    diapering,
    feeding,
    sleep,
    mood,
    health,
    pregnancy,
    play,
    milestones: milestones.sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at)),
    notes: {
      entries: notes.sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at)),
      keywords: keywordSummary,
    },
  };
}

function emptyAnalytics() {
  return {
    totals: { totalEvents: 0, dayCount: 0, from: null, to: null },
    diapering: initDiapering([]),
    feeding: initFeeding([]),
    sleep: initSleep([]),
    mood: initMood([]),
    health: initHealth(),
    pregnancy: initPregnancy([]),
    play: initPlay([]),
    milestones: [],
    notes: { entries: [], keywords: [] },
  };
}

function enumerateDays(from, to) {
  const days = [];
  const start = new Date(from);
  const end = new Date(to);
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    days.push(formatDay(cursor));
    cursor.setTime(cursor.getTime() + DAY_MS);
  }
  return days;
}

function initPerDayMap(days, initialValue) {
  const map = new Map();
  days.forEach(day => {
    if (typeof initialValue === 'function') {
      map.set(day, initialValue(day));
    } else if (Array.isArray(initialValue)) {
      map.set(day, [...initialValue]);
    } else if (initialValue && typeof initialValue === 'object') {
      map.set(day, { ...initialValue });
    } else {
      map.set(day, initialValue);
    }
  });
  return map;
}

function ensureDay(map, key, factory) {
  if (!map.has(key)) {
    map.set(key, factory(key));
  }
  return map.get(key);
}

function initDiapering(days) {
  return {
    total: 0,
    perDay: initPerDayMap(days, () => ({ DooDoo: 0, PeePee: 0, Diaper: 0 })),
    consistency: new Map(),
    color: new Map(),
    peeAmount: new Map(),
    diaperKind: new Map(),
    lastDirty: null,
    stackedBar: [],
    consistencyPie: [],
    diaperKindPie: [],
  };
}

function initFeeding(days) {
  return {
    totalFeeds: 0,
    totalVolume: 0,
    avgIntervalMinutes: 0,
    longestFeedQuantity: 0,
    volumePerDay: initPerDayMap(days, () => ({ total: 0 })),
    volumeByType: new Map(),
    feedAmounts: [],
    volumeLine: [],
    typePie: [],
  };
}

function initSleep(days) {
  return {
    starts: [],
    ends: [],
    sessions: [],
    totalMinutes: 0,
    avgSessionMinutes: 0,
    perDayMinutes: initPerDayMap(days, () => ({ minutes: 0 })),
    perDayLine: [],
  };
}

function initMood(days) {
  const buckets = new Map();
  days.forEach(day => {
    const bucket = new Map();
    ['Night', 'Morning', 'Afternoon', 'Evening'].forEach(period => {
      bucket.set(period, { sum: 0, count: 0 });
    });
    buckets.set(day, bucket);
  });
  return {
    total: 0,
    counts: new Map(),
    buckets,
    emojiBar: [],
    heatmap: [],
  };
}

function initHealth() {
  return {
    temperatureReadings: [],
    medicines: [],
    doctorVisits: [],
    pukeCounts: new Map(),
    sickCount: 0,
    temperatureLine: [],
    pukePie: [],
  };
}

function initPregnancy(days) {
  return {
    totalKicks: 0,
    kicksPerDay: initPerDayMap(days, () => ({ value: 0 })),
    contractions: [],
    heartbeatReadings: [],
    lastHeartbeat: null,
    avgContractionIntensity: { total: 0, count: 0, value: 0 },
    kicksLine: [],
  };
}

function initPlay(days) {
  return {
    totalSessions: 0,
    totalMinutes: 0,
    minutesPerDay: initPerDayMap(days, () => ({ minutes: 0 })),
    minutesLine: [],
    minutesByType: new Map(),
    minutesByTypeBar: [],
    sessions: [],
  };
}

function finalizeSleep(sleep) {
  if (!sleep.ends.length && !sleep.starts.length) return;
  const starts = sleep.starts.map(ev => ({ ...ev, used: false })).sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
  const ends = sleep.ends.sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
  ends.forEach(end => {
    let startMatch = null;
    for (let i = starts.length - 1; i >= 0; i -= 1) {
      if (starts[i].used) continue;
      if (new Date(starts[i].occurred_at) <= new Date(end.occurred_at)) {
        startMatch = starts[i];
        starts[i].used = true;
        break;
      }
    }
    const explicitDuration = toNumber(end.meta?.sleep?.duration_min);
    const duration = explicitDuration || (startMatch ? Math.max(0, (new Date(end.occurred_at) - new Date(startMatch.occurred_at)) / 60000) : 0);
    sleep.sessions.push({
      id: end.id,
      start: startMatch?.occurred_at || null,
      end: end.occurred_at,
      duration,
    });
    const dayKey = dayFromISO(end.occurred_at);
    ensureDay(sleep.perDayMinutes, dayKey, () => ({ minutes: 0 })).minutes += duration;
    sleep.totalMinutes += duration;
  });
  sleep.avgSessionMinutes = sleep.sessions.length ? sleep.totalMinutes / sleep.sessions.length : 0;
  sleep.perDayLine = buildLineSeries(sleep.perDayMinutes, 'Minutes');
}

function increment(target, key) {
  if (!target) return;
  target[key] = (target[key] || 0) + 1;
}

function dayFromISO(iso) {
  if (!iso) return 'unknown';
  return iso.slice(0, 10);
}

function formatDay(date) {
  return date.toISOString().slice(0, 10);
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function computeAverageInterval(times) {
  if (times.length < 2) return 0;
  const sorted = [...times].sort((a, b) => a - b);
  let total = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    total += (sorted[i] - sorted[i - 1]) / 60000;
  }
  return total / (sorted.length - 1);
}

function buildLineSeries(map, label) {
  const data = [];
  map.forEach((value, key) => {
    const y = typeof value === 'object' && value !== null ? (value.total ?? value.value ?? value.minutes ?? 0) : value;
    data.push({ x: key, y });
  });
  data.sort((a, b) => (a.x < b.x ? -1 : 1));
  return [{ id: label, data }];
}

function buildStackedBar(perDayMap) {
  const rows = [];
  perDayMap.forEach((counts, day) => {
    rows.push({ day, ...counts });
  });
  rows.sort((a, b) => (a.day < b.day ? -1 : 1));
  return rows;
}

function mapToPie(map, suffix) {
  const result = [];
  map.forEach((value, key) => {
    if (!value) return;
    result.push({ id: key, label: key, value, suffix });
  });
  return result;
}

function mapToBar(map, metric) {
  const rows = [];
  map.forEach((value, key) => {
    rows.push({ label: key, [metric]: value });
  });
  rows.sort((a, b) => b[metric] - a[metric]);
  return rows;
}

function buildMoodHeatmap(bucketMap, days) {
  const uniqueDays = new Set(days);
  bucketMap.forEach((_value, key) => uniqueDays.add(key));
  return Array.from(uniqueDays)
    .sort()
    .map(day => {
      const row = { day };
      const entries = bucketMap.get(day) || ensureDay(bucketMap, day, () => {
        const bucket = new Map();
        ['Night', 'Morning', 'Afternoon', 'Evening'].forEach(period => {
          bucket.set(period, { sum: 0, count: 0 });
        });
        return bucket;
      });
      ['Night', 'Morning', 'Afternoon', 'Evening'].forEach(period => {
        const { sum, count } = entries.get(period);
        row[period] = count ? sum / count : 0;
      });
      return row;
    });
}

function bucketForHour(hour) {
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 22) return 'Evening';
  return 'Night';
}

function buildTemperatureLine(readings) {
  const data = readings
    .map(r => ({ x: r.occurred_at, y: r.value, unit: r.unit }))
    .sort((a, b) => (a.x < b.x ? -1 : 1));
  return [{ id: 'Temperature', data }];
}

function addNote(list, event, overrideText) {
  const text = overrideText ?? extractNotes(event.meta || {});
  if (!text) return;
  list.push({ id: event.id, occurred_at: event.occurred_at, text });
}

function extractNotes(meta) {
  if (!meta || typeof meta !== 'object') return '';
  if (typeof meta.notes === 'string' && meta.notes.trim()) return meta.notes.trim();
  for (const value of Object.values(meta)) {
    if (value && typeof value === 'object') {
      const nested = extractNotes(value);
      if (nested) return nested;
    }
  }
  return '';
}

function computeKeywordSummary(notes) {
  const freq = new Map();
  notes.forEach(n => {
    const words = n.text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
    words.forEach(word => {
      if (!word || word.length < 3 || STOP_WORDS.has(word)) return;
      freq.set(word, (freq.get(word) || 0) + 1);
    });
  });
  const arr = [];
  freq.forEach((value, key) => arr.push({ word: key, count: value }));
  arr.sort((a, b) => b.count - a.count);
  return arr.slice(0, 12);
}
