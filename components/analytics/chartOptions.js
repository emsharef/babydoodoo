import { EVENT_DEFS } from '@/lib/events';

const labelRotate = length => (length > 18 ? 45 : 0);

function makeGrid(extra = {}) {
  return { left: 56, right: 24, top: 36, bottom: 52, containLabel: false, ...extra };
}

export function diaperStackedOption(days, rows) {
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0 },
    grid: makeGrid(),
    xAxis: { type: 'category', data: days, axisLabel: { rotate: labelRotate(days.length) } },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: 'DooDoo', type: 'bar', stack: 'total', emphasis: { focus: 'series' }, data: rows.map(r => r.DooDoo || 0) },
      { name: 'PeePee', type: 'bar', stack: 'total', emphasis: { focus: 'series' }, data: rows.map(r => r.PeePee || 0) },
      { name: 'Diaper', type: 'bar', stack: 'total', emphasis: { focus: 'series' }, data: rows.map(r => r.Diaper || 0) },
    ],
  };
}

export function lineOption({ days, values, unit }) {
  return {
    tooltip: { trigger: 'axis' },
    grid: makeGrid(),
    xAxis: { type: 'category', data: days, axisLabel: { rotate: labelRotate(days.length) } },
    yAxis: { type: 'value', minInterval: 1, name: unit || undefined },
    series: [{
      type: 'line',
      smooth: true,
      symbolSize: days.length > 40 ? 2 : 6,
      areaStyle: { opacity: 0.08 },
      data: values,
    }],
  };
}

export function multiLineOption(seriesList, days, opts = {}) {
  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: makeGrid(),
    xAxis: { type: 'category', data: days, axisLabel: { rotate: labelRotate(days.length) } },
    yAxis: { type: 'value', minInterval: 1, name: opts.unit || undefined },
    series: seriesList.map(item => ({
      type: 'line',
      name: item.name,
      smooth: true,
      symbolSize: days.length > 40 ? 2 : 6,
      areaStyle: item.area ? { opacity: 0.08 } : undefined,
      data: item.data,
    })),
  };
}

export function pieOption(data) {
  return {
    tooltip: { trigger: 'item' },
    legend: { orient: 'horizontal', bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      data: data.map(item => ({ value: item.value, name: item.label || item.id })),
    }],
  };
}

export function horizontalBarOption(entries, labelKey, valueKey, opts = {}) {
  const data = entries.slice().sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0));
  return {
    tooltip: { trigger: 'axis' },
    grid: makeGrid({ left: 120 }),
    xAxis: { type: 'value', minInterval: 1, name: opts.unit || undefined },
    yAxis: { type: 'category', data: data.map(item => item[labelKey]), inverse: true },
    series: [{
      type: 'bar',
      data: data.map(item => item[valueKey] || 0),
      label: { show: true, position: 'right' },
      barMaxWidth: 36,
    }],
  };
}

export function heatmapOption(days, matrix) {
  const keys = ['Night', 'Morning', 'Afternoon', 'Evening'];
  const data = matrix.map(row => keys.map(k => row[k])).flatMap((row, y) =>
    row.map((val, x) => [x, y, Number.isFinite(val) ? Number(val.toFixed(2)) : 0])
  );
  return {
    tooltip: { position: 'top' },
    grid: { left: 72, right: 24, top: 16, bottom: 36 },
    xAxis: { type: 'category', data: keys },
    yAxis: { type: 'category', data: days },
    visualMap: {
      min: -2,
      max: 3,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
    },
    series: [{
      type: 'heatmap',
      data,
      label: { show: true, formatter: params => (params.value[2] ? params.value[2].toFixed(1) : '') },
      emphasis: { focus: 'series' },
    }],
  };
}

export function scatterOption({ points, xLabel, yLabel }) {
  return {
    tooltip: { trigger: 'item', formatter: ({ value }) => `${xLabel}: ${value[0]}<br/>${yLabel}: ${value[1]}` },
    grid: makeGrid(),
    xAxis: { type: 'value', name: xLabel },
    yAxis: { type: 'value', name: yLabel },
    series: [{ type: 'scatter', symbolSize: 10, data: points }],
  };
}

const eventDefMap = new Map(EVENT_DEFS.map(d => [d.type, d]));

// Fixed x-offsets: left→right order:
// notes/mood/milestone → pregnancy → health → play/cry/blah → measure → sleep → feed → diaper
// Centered around 0, spread across ~0.7 of a day column (-0.35 to +0.35)
const CALENDAR_TYPE_OFFSETS = {
  // Notes & mood (far left)
  Note:        -0.35,
  Milestone:   -0.35,
  BabyMood:    -0.30,
  MyMood:      -0.30,
  // Pregnancy
  KickMe:      -0.22,
  Contraction: -0.22,
  Heartbeat:   -0.22,
  // Health
  Doctor:      -0.14,
  Medicine:    -0.11,
  Sick:        -0.08,
  Puke:        -0.08,
  Temperature: -0.05,
  // Play & misc
  Play:         0.00,
  CryCry:       0.00,
  BlahBlah:     0.00,
  // Measure
  Measure:      0.07,
  // Sleep
  SleepStart:   0.14,
  SleepEnd:     0.14,
  // Feeding
  YumYum:       0.22,
  // Diapering (far right)
  DooDoo:       0.28,
  PeePee:       0.32,
  Diaper:       0.35,
};

function formatMeta(type, meta) {
  if (!meta || typeof meta !== 'object') return '';
  const parts = [];
  switch (type) {
    case 'DooDoo':
      if (meta.doo?.consistency) parts.push(meta.doo.consistency);
      if (meta.doo?.color) parts.push(meta.doo.color);
      break;
    case 'PeePee':
      if (meta.pee?.amount) parts.push(meta.pee.amount);
      break;
    case 'Diaper':
      if (meta.diaper?.kind) parts.push(meta.diaper.kind);
      break;
    case 'YumYum':
      if (meta.yum?.quantity) parts.push(`${meta.yum.quantity} ml`);
      if (meta.yum?.kind) parts.push(meta.yum.kind);
      break;
    case 'Temperature':
      if (meta.temp?.value) parts.push(`${meta.temp.value}°${meta.temp?.unit || 'F'}`);
      break;
    case 'Medicine':
      if (meta.medicine?.name) parts.push(meta.medicine.name);
      if (meta.medicine?.dose) parts.push(`${meta.medicine.dose}${meta.medicine?.unit || ''}`);
      break;
    case 'BabyMood':
    case 'MyMood':
      if (meta.mood) parts.push(typeof meta.mood === 'string' ? meta.mood : meta.mood?.emoji || '');
      break;
    case 'Play':
      if (meta.play?.kind) parts.push(meta.play.kind);
      if (meta.play?.duration_min) parts.push(`${meta.play.duration_min} min`);
      break;
    case 'Milestone':
      if (meta.milestone?.title) parts.push(meta.milestone.title);
      break;
    case 'Measure':
      if (meta.measure?.type) parts.push(meta.measure.type);
      if (meta.measure?.value) parts.push(`${meta.measure.value} ${meta.measure?.unit || ''}`);
      break;
    case 'KickMe':
      if (meta.kick?.count) parts.push(`${meta.kick.count} kicks`);
      break;
    case 'Contraction':
      if (meta.contraction?.duration_sec) parts.push(`${meta.contraction.duration_sec}s`);
      if (meta.contraction?.intensity) parts.push(`intensity ${meta.contraction.intensity}`);
      break;
    case 'Heartbeat':
      if (meta.heartbeat?.bpm) parts.push(`${meta.heartbeat.bpm} bpm`);
      break;
    case 'Puke':
      if (meta.puke?.amount) parts.push(meta.puke.amount);
      break;
    default: break;
  }
  const notes = meta.notes || (meta[Object.keys(meta)[0]]?.notes);
  if (typeof notes === 'string' && notes.trim()) {
    parts.push(notes.trim().length > 40 ? notes.trim().slice(0, 40) + '…' : notes.trim());
  }
  return parts.filter(Boolean).join(' · ');
}

export function eventCalendarOption({ points, days }) {
  const dayIndex = new Map();
  days.forEach((d, i) => dayIndex.set(d, i));

  // Group points by event type
  const byType = new Map();
  points.forEach(pt => {
    if (!byType.has(pt.eventType)) byType.set(pt.eventType, []);
    byType.get(pt.eventType).push(pt);
  });

  const series = [];
  byType.forEach((pts, eventType) => {
    const def = eventDefMap.get(eventType);
    const emoji = def?.emoji || '?';
    const xOff = CALENDAR_TYPE_OFFSETS[eventType] ?? 0;
    series.push({
      name: eventType,
      type: 'scatter',
      symbol: 'circle',
      symbolSize: 1,
      itemStyle: { color: 'transparent' },
      data: pts.map(pt => {
        const baseX = dayIndex.get(pt.day) ?? 0;
        return {
          value: [baseX + xOff, pt.timeOfDay],
          _emoji: emoji,
          _type: eventType,
          _time: pt.occurredAt,
          _detail: formatMeta(eventType, pt.meta),
        };
      }),
      label: {
        show: true,
        position: 'inside',
        formatter: params => params.data._emoji,
        fontSize: 16,
      },
      emphasis: { scale: false },
    });
  });

  return {
    tooltip: {
      trigger: 'item',
      formatter: params => {
        const d = params.data;
        const def = eventDefMap.get(d._type);
        const emoji = def?.emoji || '';
        const time = d._time ? new Date(d._time).toLocaleString() : '';
        let html = `${emoji} <strong>${d._type}</strong><br/>${time}`;
        if (d._detail) html += `<br/><span style="color:#888">${d._detail}</span>`;
        return html;
      },
    },
    grid: { left: 56, right: 24, top: 12, bottom: 16, containLabel: true },
    xAxis: {
      type: 'value',
      min: -0.6,
      max: days.length - 0.4,
      interval: 1,
      axisLabel: {
        showMinLabel: false,
        showMaxLabel: false,
        formatter: val => {
          const idx = Math.round(val);
          if (idx < 0 || idx >= days.length) return '';
          return days[idx] || '';
        },
        rotate: labelRotate(days.length),
        fontSize: 11,
      },
      axisTick: { show: false },
      splitLine: { show: true, lineStyle: { type: 'dashed', color: '#eee' } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 24,
      inverse: true,
      interval: 3,
      axisLabel: {
        formatter: val => `${String(Math.round(val)).padStart(2, '0')}:00`,
      },
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
    ],
    series,
  };
}
