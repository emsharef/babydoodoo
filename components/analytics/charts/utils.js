export function formatDateLabel(value) {
  if (typeof value !== 'string') return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) || value.includes('T')) {
    const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  }
  return value;
}

export function formatFullDate(value) {
  if (typeof value !== 'string') return String(value);
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleString();
  }
  return value;
}

export function robustMax(values, percentile = 0.9) {
  const cleaned = values
    .filter(v => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (cleaned.length === 0) return 1;
  const idx = Math.min(cleaned.length - 1, Math.floor(cleaned.length * percentile));
  return Math.max(1, cleaned[idx]);
}
