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
