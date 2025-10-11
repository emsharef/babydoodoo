'use client';

export default function ChartCard({ title, description, children, height = 320 }) {
  return (
    <section style={{
      background: '#fff',
      border: '1px solid #ececf2',
      borderRadius: 14,
      padding: '16px 18px',
      display: 'grid',
      gap: 12,
      boxShadow: '0 3px 12px rgba(14, 30, 84, 0.06)'
    }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <strong style={{ fontSize: 16 }}>{title}</strong>
        {description ? <span style={{ fontSize: 13, color: '#777' }}>{description}</span> : null}
      </header>
      <div style={{ height, position: 'relative' }}>
        {children}
      </div>
    </section>
  );
}
