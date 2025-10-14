'use client';

export default function CategoryTabs({ categories, active, onSelect, disabledKeys = new Set() }) {
  const enabled = [];
  const disabled = [];
  categories.forEach(cat => {
    if (disabledKeys.has(cat.key)) disabled.push(cat);
    else enabled.push(cat);
  });
  const ordered = [...enabled, ...disabled];

  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
      {ordered.map(cat => {
        const isActive = cat.key === active;
        const isDisabled = disabledKeys.has(cat.key);
        return (
          <button
            key={cat.key}
            type="button"
            onClick={() => { if (!isDisabled) onSelect(cat.key); }}
            style={{
              flexShrink: 0,
              padding: '10px 14px',
              borderRadius: 999,
              border: `1px solid ${isActive ? '#4f7cff' : '#dcdce3'}`,
              background: isActive ? '#e6edff' : isDisabled ? '#f7f8fb' : '#fff',
              color: isActive ? '#1d3a8a' : isDisabled ? '#9ea2b8' : '#333',
              fontWeight: 600,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.6 : 1,
              transition: 'all .15s ease',
            }}
            disabled={isDisabled}
            aria-disabled={isDisabled}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
