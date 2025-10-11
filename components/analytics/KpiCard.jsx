'use client';

export default function KpiCard({ title, value, subtitle, delta }) {
  return (
    <div style={{
      flex: '1 1 200px',
      minWidth: 180,
      background: '#fff',
      border: '1px solid #ececf2',
      borderRadius: 12,
      padding: '14px 16px',
      display: 'grid',
      gap: 6,
      boxShadow: '0 2px 8px rgba(14, 30, 84, 0.05)'
    }}>
      <span style={{ fontSize: 13, color: '#666', fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 26, fontWeight: 700 }}>{value}</span>
      {subtitle ? <span style={{ fontSize: 12, color: '#888' }}>{subtitle}</span> : null}
      {delta ? <span style={{ fontSize: 12, color: delta > 0 ? '#177245' : '#b00020' }}>{delta > 0 ? `▲ ${delta}` : `▼ ${Math.abs(delta)}`}</span> : null}
    </div>
  );
}
