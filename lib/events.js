// lib/events.js
export const EVENT_DEFS = [
  // Diapering & potty
  { type:'DooDoo', emoji:'💩', label:'DooDoo', bg:'#fff3b0', bd:'#f0d264' },
  { type:'PeePee', emoji:'💧', label:'PeePee', bg:'#d6f0ff', bd:'#96c8ee' },
  { type:'Diaper', emoji:'🧷', label:'Diaper', bg:'#f7f7f7', bd:'#dedede' },

  // Feeding
  { type:'YumYum', emoji:'🍼', label:'YumYum', bg:'#dff7d9', bd:'#9ed69b' },

  // Sleep
  { type:'SleepStart', emoji:'🛌', label:'SleepStart', bg:'#e8f4ff', bd:'#a9c9ff' },
  { type:'SleepEnd', emoji:'🌞', label:'SleepEnd', bg:'#fff1e0', bd:'#ffd0a1' },

  // Health
  { type:'Puke', emoji:'🤮', label:'Puke', bg:'#e8ffd8', bd:'#b7e69a' },
  { type:'Sick', emoji:'🤒', label:'Sick', bg:'#ffe9cc', bd:'#ffc27a' },
  { type:'Temperature', emoji:'🌡️', label:'Temperature', bg:'#fdebd3', bd:'#fdc889' },
  { type:'Medicine', emoji:'💊', label:'Medicine', bg:'#ffeaf0', bd:'#ffb5c9' },
  { type:'Doctor', emoji:'🩺', label:'Doctor', bg:'#eef6ff', bd:'#c7ddff' },

  // Mood & play
  { type:'BabyMood', emoji:'👶', label:'BabyMood', bg:'#f1e0ff', bd:'#c9a5ff' },
  { type:'MyMood', emoji:'🙂', label:'MyMood', bg:'#ffdff1', bd:'#f4a6dc' },
  { type:'Play', emoji:'🧸', label:'Play', bg:'#f0fff0', bd:'#cfe9cf' },

  // Milestones / notes
  { type:'Milestone', emoji:'⭐', label:'Milestone', bg:'#fff7d6', bd:'#f3da83' },
  { type:'Note', emoji:'📝', label:'Note', bg:'#f5f5f7', bd:'#e8e8ee' },

  // Pregnancy
  { type:'KickMe', emoji:'🦶', label:'KickMe', bg:'#efe0ff', bd:'#c7a7ff' },
  { type:'Contraction', emoji:'⏱️', label:'Contraction', bg:'#ffe0e0', bd:'#ffb3b3' },
  { type:'Heartbeat', emoji:'❤️', label:'Heartbeat', bg:'#ffe2ea', bd:'#f3b3c2' },

  // Misc
  { type:'CryCry', emoji:'😭', label:'CryCry', bg:'#ffe3f0', bd:'#ffb3d0' },
  { type:'BlahBlah', emoji:'🗣️', label:'BlahBlah', bg:'#eaf7ff', bd:'#b9e2ff' },
  { type:'Measure', emoji:'📏', label:'Measure', bg:'#f6f1ff', bd:'#d4c6ff' },
];

export function makeDefaultButtonConfig() {
  return { items: EVENT_DEFS.map(d => ({ type: d.type, show: true })) };
}

/**
 * Apply a saved { items: [{type, show}] } to the full defs list.
 * - Keeps only items with show !== false.
 * - Respects the ORDER from config.
 * - Does NOT re-append hidden items at the end.
 * - Appends only defs that are truly missing from config (new event types).
 */
export function applyButtonConfig(defs, config) {
  const items = Array.isArray(config?.items) ? config.items : null;
  if (!items) return defs.slice();

  const known = new Map(defs.map((d, idx) => [d.type, { d, defaultIdx: idx }]));

  // Types that appear in config (regardless of show) -> considered "configured"
  const configuredTypes = items.filter(it => known.has(it.type)).map(it => it.type);
  const configuredSet = new Set(configuredTypes);

  // Build list from config order, but include only show !== false
  const shownFromConfig = items
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => it.show !== false && known.has(it.type))
    .sort((a, b) => a.idx - b.idx)
    .map(({ it }) => known.get(it.type).d);

  // Append only brand-new defs not present in config at all
  const missingNewDefs = defs.filter(d => !configuredSet.has(d.type));

  return [...shownFromConfig, ...missingNewDefs];
}
