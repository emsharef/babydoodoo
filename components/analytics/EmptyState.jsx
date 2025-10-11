'use client';

export default function EmptyState({ message }) {
  return (
    <div style={{
      border: '1px dashed #d9d9e3',
      borderRadius: 12,
      padding: '24px 18px',
      textAlign: 'center',
      color: '#777'
    }}>
      <span role="img" aria-label="No data" style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>📊</span>
      <p style={{ margin: 0, fontSize: 14 }}>{message}</p>
    </div>
  );
}
